import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { IBServiceOptimized } from '../services/ibServiceOptimized.js';
import { IBConnectionService } from '../services/ibConnectionService.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();

// Helper function to get user settings
async function getUserSettings(userId: number) {
  const userSettings = await IBConnectionService.getUserIBSettings(userId);
  if (!userSettings) {
    throw new Error('IB connection not configured. Please configure your IB settings first.');
  }
  return userSettings;
}

// Helper function to update account balance and performance
async function updateAccountAndPerformance(userId: number, accountId: number, balance: number, currency: string, note: string) {
  try {
    const { AccountModel } = await import('../models/Account.js');
    await AccountModel.updateBalanceWithHistory(accountId, userId, balance, note);
    Logger.debug(`💰 Updated account balance: ${balance} ${currency}`);
  } catch (error) {
    Logger.error('❌ Failed to update account balance:', error);
  }

  try {
    const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
    await PerformanceHistoryService.calculateTodaySnapshot(userId);
    Logger.info('📈 Updated performance snapshot');
  } catch (error) {
    Logger.error('❌ Failed to update performance snapshot:', error);
  }
}

// Get IB connection settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    return res.json(userSettings || {
      host: 'localhost',
      port: 7497,
      client_id: 1,
      target_account_id: null
    });
  } catch (error) {
    Logger.error('Error getting IB settings:', error);
    return res.status(500).json({ error: 'Failed to get IB settings' });
  }
});

// Save IB connection settings
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { host, port, client_id, target_account_id } = req.body;
    
    if (!host || !port || !client_id) {
      return res.status(400).json({ error: 'Host, port, and client ID are required' });
    }
    
    const parsedTarget = target_account_id === 'none' ? undefined : parseInt(target_account_id);
    const settings = {
      host,
      port: parseInt(port),
      client_id: parseInt(client_id),
      ...(parsedTarget !== undefined ? { target_account_id: parsedTarget } : {})
    };
    
    await IBConnectionService.saveUserIBSettings(userId, settings);
    return res.json({ success: true, message: 'IB settings saved successfully' });
  } catch (error) {
    Logger.error('Error saving IB settings:', error);
    return res.status(500).json({ error: 'Failed to save IB settings' });
  }
});

// Get portfolio data from database
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userSettings = await getUserSettings(userId);
    
    const { dbAll } = await import('../database/connection.js');
    const portfolio = await dbAll(
      'SELECT * FROM portfolios WHERE source = ? AND main_account_id = ? ORDER BY symbol',
      ['IB', userSettings.target_account_id]
    );
    
    return res.json(portfolio);
  } catch (error) {
    Logger.error('Error getting portfolio:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get portfolio' });
  }
});

// Refresh portfolio (optimized)
router.post('/portfolio/refresh', authenticateToken, async (req, res) => {
  try {
    Logger.info('🔄 Portfolio refresh requested');
    const userId = (req as any).user.id;
    const userSettings = await getUserSettings(userId);
    
    const result = await IBServiceOptimized.refreshPortfolio(userSettings);
    
    if (userSettings.target_account_id && result.balance) {
      await updateAccountAndPerformance(
        userId,
        userSettings.target_account_id,
        result.balance.balance,
        result.balance.currency,
        'IB portfolio refresh'
      );
    }
    
    Logger.info('✅ Portfolio refresh complete');
    return res.json(result);
  } catch (error) {
    Logger.error('❌ Portfolio refresh failed:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to refresh portfolio' });
  }
});

// Get account balance from database
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userSettings = await getUserSettings(userId);
    
    const { dbGet } = await import('../database/connection.js');
    const account = await dbGet(
      'SELECT current_balance, currency, last_updated FROM accounts WHERE id = ?',
      [userSettings.target_account_id]
    );
    
    return res.json({
      balance: account?.current_balance || 0,
      currency: account?.currency || 'USD',
      lastUpdated: account?.last_updated
    });
  } catch (error) {
    Logger.error('Error getting balance:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get balance' });
  }
});

// Get cash balances from database
router.get('/cash', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userSettings = await getUserSettings(userId);
    
    const { dbAll } = await import('../database/connection.js');
    const cashBalances = await dbAll(
      'SELECT * FROM cash_balances WHERE main_account_id = ? AND source = ? ORDER BY currency',
      [userSettings.target_account_id, 'IB']
    );
    
    return res.json(cashBalances);
  } catch (error) {
    Logger.error('Error getting cash balances:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get cash balances' });
  }
});

// Get all account data (balance + portfolio + cash)
router.get('/account-data', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userSettings = await getUserSettings(userId);
    
    const { dbGet, dbAll } = await import('../database/connection.js');
    
    const [account, portfolio, cashBalances] = await Promise.all([
      dbGet('SELECT current_balance, currency, last_updated FROM accounts WHERE id = ?', [userSettings.target_account_id]),
      dbAll('SELECT * FROM portfolios WHERE source = ? AND main_account_id = ? ORDER BY symbol', ['IB', userSettings.target_account_id]),
      dbAll('SELECT * FROM cash_balances WHERE main_account_id = ? AND source = ? ORDER BY currency', [userSettings.target_account_id, 'IB'])
    ]);
    
    return res.json({
      balance: {
        balance: account?.current_balance || 0,
        currency: account?.currency || 'USD',
        lastUpdated: account?.last_updated
      },
      portfolio,
      cashBalances
    });
  } catch (error) {
    Logger.error('Error getting account data:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get account data' });
  }
});

// Get refresh status
router.get('/refresh-status', authenticateToken, async (_req, res) => {
  try {
    const status = IBServiceOptimized.getRefreshStatus();
    
    return res.json({
      success: true,
      isActive: status.isActive,
      subscriptions: {
        accountUpdates: status.subscriptions.accountUpdates
      }
    });
  } catch (error) {
    Logger.error('Error getting refresh status:', error);
    return res.status(500).json({ error: 'Failed to get refresh status' });
  }
});

// Stop refresh
router.post('/stop-refresh', authenticateToken, async (_req, res) => {
  try {
    await IBServiceOptimized.stopRefresh();
    return res.json({ success: true, message: 'Refresh stopped' });
  } catch (error) {
    Logger.error('Error stopping refresh:', error);
    return res.status(500).json({ error: 'Failed to stop refresh' });
  }
});

// Disconnect from IB Gateway
router.post('/disconnect', authenticateToken, async (_req, res) => {
  try {
    await IBServiceOptimized.stopRefresh();
    await IBServiceOptimized.disconnect();
    return res.json({ success: true, message: 'Disconnected from IB Gateway' });
  } catch (error) {
    Logger.error('Error disconnecting:', error);
    return res.status(500).json({ error: 'Failed to disconnect from IB Gateway' });
  }
});

export default router;
