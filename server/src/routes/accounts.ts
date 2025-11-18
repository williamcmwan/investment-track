import express from 'express';
import { z } from 'zod';
import { AccountModel, CreateAccountData, UpdateAccountData } from '../models/Account.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { PerformanceHistoryService } from '../services/performanceHistoryService.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1),
  currency: z.string().min(3).max(3),
  accountType: z.enum(['INVESTMENT', 'BANK']).default('INVESTMENT'),
  accountNumber: z.string().optional(),
  originalCapital: z.number().nonnegative(),
  currentBalance: z.number().nonnegative()
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  accountType: z.enum(['INVESTMENT', 'BANK']).optional(),
  accountNumber: z.string().optional(),
  originalCapital: z.number().nonnegative().optional(),
  currentBalance: z.number().nonnegative().optional()
});

// Get all accounts for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await AccountModel.findByUserId(req.user?.id || 0);
    
    // Get history for each account
    const accountsWithHistory = await Promise.all(
      accounts.map(async (account) => {
        const history = await AccountModel.getBalanceHistory(account.id);
        return {
          ...account,
          history
        };
      })
    );
    
    return res.json(accountsWithHistory);
  } catch (error) {
    Logger.error('Get accounts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific account with history
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const account = await AccountModel.getWithHistory(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Recalculate today's performance snapshot after successful update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      Logger.warn('Performance snapshot update failed after account update');
    }

    return res.json(account);
  } catch (error) {
    Logger.error('Get account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new account
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);
    
    const account = await AccountModel.create(req.user?.id || 0, validatedData as CreateAccountData);
    return res.status(201).json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    Logger.error('Create account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update account
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const validatedData = updateAccountSchema.parse(req.body);
    
    const account = await AccountModel.update(accountId, req.user?.id || 0, validatedData as UpdateAccountData);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // If balance was updated, add to history
    if (validatedData.currentBalance !== undefined) {
      // Get the date from the request body, default to today if not provided
      const updateDate = req.body.date || new Date().toISOString().split('T')[0];
      
      // Check if this date is older than the latest history entry
      const latestHistoryDate = await AccountModel.getLatestHistoryDate(accountId);
      
      if (latestHistoryDate && new Date(updateDate) < new Date(latestHistoryDate)) {
        // Don't update the account balance for older dates, just add to history
        await AccountModel.addBalanceHistory(accountId, validatedData.currentBalance, 'Balance updated', updateDate);
        
        // Revert the account balance to the most recent history entry
        const latestHistory = await AccountModel.getBalanceHistory(accountId);
        if (latestHistory.length > 0 && latestHistory[0]) {
          await AccountModel.update(accountId, req.user?.id || 0, { 
            currentBalance: latestHistory[0].balance 
          });
        }
      } else {
        // Normal update - update balance and add to history
        await AccountModel.addBalanceHistory(accountId, validatedData.currentBalance, 'Balance updated', updateDate);
      }
    }
    
    // Recalculate today's performance snapshot after any account update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      Logger.warn('Performance snapshot update failed after account update');
    }
    
    return res.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    Logger.error('Update account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const deleted = await AccountModel.delete(accountId, req.user?.id || 0);
    if (!deleted) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    Logger.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add balance history entry
router.post('/:id/history', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }
    
    const { balance, note, date } = req.body;
    if (typeof balance !== 'number' || !note) {
      return res.status(400).json({ error: 'Balance and note are required' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.addBalanceHistory(accountId, balance, note, date);

    // Recalculate today's performance snapshot after history add
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      Logger.warn('Performance snapshot update failed after adding history');
    }

    return res.status(201).json({ message: 'Balance history entry added' });
  } catch (error) {
    Logger.error('Add balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update balance history entry
router.put('/:id/history/:historyId', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    const historyId = parseInt(req.params.historyId || '0');
    
    if (isNaN(accountId) || isNaN(historyId)) {
      return res.status(400).json({ error: 'Invalid account or history ID' });
    }
    
    const { balance, note, date } = req.body;
    if (typeof balance !== 'number' || !note || !date) {
      return res.status(400).json({ error: 'Balance, note, and date are required' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.updateBalanceHistory(historyId, accountId, balance, note, date);

    // Recalculate today's performance snapshot after history update
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      Logger.warn('Performance snapshot update failed after updating history');
    }

    return res.json({ message: 'Balance history entry updated' });
  } catch (error) {
    Logger.error('Update balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete balance history entry
router.delete('/:id/history/:historyId', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    const historyId = parseInt(req.params.historyId || '0');
    
    if (isNaN(accountId) || isNaN(historyId)) {
      return res.status(400).json({ error: 'Invalid account or history ID' });
    }
    
    // Verify account belongs to user
    const account = await AccountModel.findById(accountId, req.user?.id || 0);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await AccountModel.deleteBalanceHistory(historyId, accountId);

    // Recalculate today's performance snapshot after history delete
    try {
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
    } catch (e) {
      Logger.warn('Performance snapshot update failed after deleting history');
    }

    return res.json({ message: 'Balance history entry deleted' });
  } catch (error) {
    Logger.error('Delete balance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Integration validation schemas
const ibIntegrationSchema = z.object({
  type: z.literal('IB'),
  host: z.string().min(1),
  port: z.number().int().positive(),
  clientId: z.number().int().nonnegative(),
  lastConnected: z.string().optional()
});

const schwabIntegrationSchema = z.object({
  type: z.literal('SCHWAB'),
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.number().optional(),
  accountHash: z.string().optional()
});

const integrationSchema = z.discriminatedUnion('type', [
  ibIntegrationSchema,
  schwabIntegrationSchema
]);

// Get integration config for account
router.get('/:id/integration', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const config = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    if (!config) {
      return res.json({ type: null, config: null });
    }

    // Don't send sensitive data to client
    if (config.type === 'SCHWAB') {
      const schwabConfig = config as any;
      return res.json({
        type: 'SCHWAB',
        config: {
          appKey: schwabConfig.appKey,
          hasTokens: !!(schwabConfig.accessToken && schwabConfig.refreshToken),
          accountHash: schwabConfig.accountHash
        }
      });
    }

    // For IB, return the config directly (it already has the type field)
    return res.json({ type: config.type, config: config });
  } catch (error) {
    Logger.error('Get integration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Set integration config for account
router.put('/:id/integration', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    Logger.info(`📝 Setting integration for account ${accountId}:`, req.body);
    
    // Check if this is a partial update (e.g., only updating accountHash)
    const existingConfig = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    let configToSave = req.body;
    
    // If there's an existing config and we're only updating certain fields, merge them
    if (existingConfig && req.body.type === existingConfig.type) {
      if (req.body.type === 'SCHWAB') {
        // For Schwab, allow partial updates (e.g., just accountHash)
        configToSave = {
          type: 'SCHWAB',
          appKey: req.body.appKey || (existingConfig as any).appKey,
          appSecret: req.body.appSecret || (existingConfig as any).appSecret,
          accessToken: req.body.accessToken || (existingConfig as any).accessToken,
          refreshToken: req.body.refreshToken || (existingConfig as any).refreshToken,
          tokenExpiresAt: req.body.tokenExpiresAt || (existingConfig as any).tokenExpiresAt,
          accountHash: req.body.accountHash || (existingConfig as any).accountHash
        };
      }
    }
    
    const validatedConfig = integrationSchema.parse(configToSave);
    
    Logger.info(`✅ Validated config:`, validatedConfig);
    
    const account = await AccountModel.setIntegration(
      accountId,
      req.user?.id || 0,
      validatedConfig.type,
      validatedConfig as any
    );

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    Logger.info(`✅ Set ${validatedConfig.type} integration for account ${accountId}`);
    Logger.info(`📊 Updated account:`, account);
    
    return res.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid integration config', details: error.errors });
    }
    
    Logger.error('Set integration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove integration from account
router.delete('/:id/integration', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const account = await AccountModel.removeIntegration(accountId, req.user?.id || 0);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    Logger.info(`✅ Removed integration from account ${accountId}`);
    return res.json(account);
  } catch (error) {
    Logger.error('Remove integration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Test integration connection
router.post('/:id/integration/test', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const config = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    if (!config) {
      return res.status(400).json({ error: 'No integration configured for this account' });
    }

    if (config.type === 'IB') {
      // Test IB connection
      const { IBService } = await import('../services/ibService.js');
      const ibConfig = config as any;
      
      try {
        // Disconnect any existing connection to force a fresh connection test
        Logger.info(`🧪 Testing IB connection to ${ibConfig.host}:${ibConfig.port}...`);
        await IBService.disconnect();
        
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force refresh to actually test the connection to IB Gateway
        const result = await IBService.forceRefreshAccountBalance({
          host: ibConfig.host,
          port: ibConfig.port,
          client_id: ibConfig.clientId,
          target_account_id: accountId
        });
        
        return res.json({ 
          success: true, 
          message: 'IB connection successful',
          balance: result?.balance,
          currency: result?.currency
        });
      } catch (error: any) {
        Logger.error('IB connection test failed:', error);
        return res.json({ 
          success: false, 
          message: 'IB connection failed',
          error: error.message 
        });
      }
    } else if (config.type === 'SCHWAB') {
      // Test Schwab connection
      const schwabConfig = config as any;
      
      // Check if tokens exist
      if (!schwabConfig.accessToken || !schwabConfig.refreshToken) {
        return res.json({ 
          success: false, 
          message: 'Schwab tokens not found. Please complete OAuth authentication.',
          error: 'No tokens available'
        });
      }
      
      // Check if tokens are expired (basic check)
      const now = Math.floor(Date.now() / 1000);
      if (schwabConfig.tokenExpiresAt && schwabConfig.tokenExpiresAt < now) {
        return res.json({ 
          success: false, 
          message: 'Schwab tokens expired. Please re-authenticate through OAuth.',
          error: 'Tokens expired'
        });
      }
      
      return res.json({ 
        success: true, 
        message: 'Schwab integration configured with valid tokens',
        hasTokens: true,
        tokenExpiresAt: schwabConfig.tokenExpiresAt
      });
    }

    return res.status(400).json({ error: 'Unknown integration type' });
  } catch (error) {
    Logger.error('Test integration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio positions for account
router.get('/:id/integration/portfolio', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const config = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    if (!config) {
      return res.status(400).json({ error: 'No integration configured for this account' });
    }

    if (config.type === 'IB') {
      const { IBService } = await import('../services/ibService.js');
      const ibConfig = config as any;
      
      const portfolio = await IBService.getPortfolio({
        host: ibConfig.host,
        port: ibConfig.port,
        client_id: ibConfig.clientId,
        target_account_id: accountId
      });

      return res.json({ success: true, portfolio: portfolio || [] });
    } else if (config.type === 'SCHWAB') {
      const { SchwabService } = await import('../services/schwabService.js');
      const schwabConfig = config as any;

      if (!schwabConfig.accountHash) {
        return res.status(400).json({ error: 'Schwab account hash not configured' });
      }

      const positions = await SchwabService.getPositionsForAccount(
        accountId,
        req.user?.id || 0,
        schwabConfig.accountHash
      );

      return res.json({ success: true, portfolio: positions || [] });
    }

    return res.status(400).json({ error: 'Unknown integration type' });
  } catch (error: any) {
    Logger.error('Get portfolio error:', error);
    return res.status(500).json({ 
      error: 'Failed to get portfolio',
      details: error.message 
    });
  }
});

// Get cash balances for account
router.get('/:id/integration/cash', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const config = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    if (!config) {
      return res.status(400).json({ error: 'No integration configured for this account' });
    }

    if (config.type === 'IB') {
      const { IBService } = await import('../services/ibService.js');
      const ibConfig = config as any;
      
      const cash = await IBService.getCashBalances({
        host: ibConfig.host,
        port: ibConfig.port,
        client_id: ibConfig.clientId,
        target_account_id: accountId
      });

      return res.json({ success: true, cash: cash || [] });
    } else if (config.type === 'SCHWAB') {
      // Schwab cash is included in the account balance
      // For now, return the account balance as cash
      const account = await AccountModel.findById(accountId, req.user?.id || 0);
      if (account) {
        return res.json({ 
          success: true, 
          cash: [{ currency: account.currency, balance: account.currentBalance }] 
        });
      }
      return res.json({ success: true, cash: [] });
    }

    return res.status(400).json({ error: 'Unknown integration type' });
  } catch (error: any) {
    Logger.error('Get cash balances error:', error);
    return res.status(500).json({ 
      error: 'Failed to get cash balances',
      details: error.message 
    });
  }
});

// Refresh balance from integration
router.post('/:id/integration/refresh', async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = parseInt(req.params.id || '0');
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const config = await AccountModel.getIntegration(accountId, req.user?.id || 0);
    
    if (!config) {
      return res.status(400).json({ error: 'No integration configured for this account' });
    }

    if (config.type === 'IB') {
      // Refresh from IB
      const { IBService } = await import('../services/ibService.js');
      const ibConfig = config as any;
      
      const result = await IBService.forceRefreshAccountBalance({
        host: ibConfig.host,
        port: ibConfig.port,
        client_id: ibConfig.clientId,
        target_account_id: accountId
      });

      if (result && result.balance) {
        // Update account balance
        await AccountModel.update(accountId, req.user?.id || 0, {
          currentBalance: result.balance
        });

        // Add balance history
        await AccountModel.addBalanceHistory(
          accountId,
          result.balance,
          'IB integration refresh'
        );

        // Recalculate performance
        await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);

        Logger.info(`✅ Refreshed IB balance for account ${accountId}: ${result.balance}`);
        return res.json({ 
          success: true, 
          balance: result.balance,
          currency: result.currency,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(500).json({ error: 'Failed to refresh balance from IB' });
    } else if (config.type === 'SCHWAB') {
      // Refresh from Schwab using account-level tokens
      const { SchwabService } = await import('../services/schwabService.js');
      const schwabConfig = config as any;

      if (!schwabConfig.accountHash) {
        return res.status(400).json({ error: 'Schwab account hash not configured. Please re-authenticate.' });
      }

      const result = await SchwabService.getAccountBalanceForAccount(
        accountId,
        req.user?.id || 0,
        schwabConfig.accountHash
      );

      if (result && result.currentBalance) {
        // Update account balance
        await AccountModel.update(accountId, req.user?.id || 0, {
          currentBalance: result.currentBalance
        });

        // Add balance history
        await AccountModel.addBalanceHistory(
          accountId,
          result.currentBalance,
          'Schwab integration refresh'
        );

        // Recalculate performance
        await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);

        Logger.info(`✅ Refreshed Schwab balance for account ${accountId}: ${result.currentBalance}`);
        return res.json({ 
          success: true, 
          balance: result.currentBalance,
          currency: result.currency || 'USD',
          timestamp: new Date().toISOString()
        });
      }

      return res.status(500).json({ error: 'Failed to refresh balance from Schwab' });
    }

    return res.status(400).json({ error: 'Unknown integration type' });
  } catch (error: any) {
    Logger.error('Refresh integration error:', error);
    return res.status(500).json({ 
      error: 'Failed to refresh balance',
      details: error.message 
    });
  }
});

export default router;
