import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { IBService } from '../services/ibService.js';
import { IBConnectionService } from '../services/ibConnectionService.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();

// Get IB connection settings (user-specific)
router.get('/ib/settings', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (userSettings) {
      return res.json(userSettings);
    } else {
      // Return default settings for first-time setup
      return res.json({
        host: 'localhost',
        port: 7497,
        client_id: 1,
        target_account_id: null
      });
    }
  } catch (error) {
    Logger.error('Error getting IB settings:', error);
    return res.status(500).json({ error: 'Failed to get IB settings' });
  }
});

// Save IB connection settings (user-specific)
router.post('/ib/settings', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { host, port, client_id, target_account_id } = req.body;
    
    // Validate required fields
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

// Get IB account balance (from database)
router.post('/ib/balance', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getAccountBalance(userSettings);
    const timestamp = userSettings.target_account_id ? await IBService.getBalanceTimestamp(userSettings.target_account_id) : null;
    return res.json({ ...result, timestamp });
  } catch (error) {
    Logger.error('Error getting IB balance:', error);
    return res.status(500).json({ error: 'Failed to get IB account balance' });
  }
});

// Force refresh IB account balance
router.post('/ib/balance/refresh', authenticateToken, async (req, res) => {
  try {
    Logger.info('🔄 Force refresh balance endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshAccountBalance(userSettings);
    
    // Update the main account balance and balance history if target account is configured
    if (userSettings.target_account_id && result) {
      try {
        const { AccountModel } = await import('../models/Account.js');
        
        // Update the account's current balance
        await AccountModel.update(userSettings.target_account_id, userId, {
          currentBalance: result.balance
        });
        
        // Add balance history entry for the manual refresh
        await AccountModel.addBalanceHistory(
          userSettings.target_account_id, 
          result.balance, 
          'Manual IB balance refresh'
        );
        
        Logger.debug(`💰 Updated account balance: ${result.balance} ${result.currency}`);
      } catch (accountError) {
        Logger.error(`❌ Failed to update account balance:`, accountError);
      }
    }
    
    // Recalculate today's performance snapshot after balance update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      Logger.info(`📈 Updated performance snapshot after balance refresh`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    const timestamp = userSettings.target_account_id ? await IBService.getBalanceTimestamp(userSettings.target_account_id) : null;
    Logger.info('✅ Balance refresh successful, returning data');
    return res.json({ ...result, timestamp });
  } catch (error) {
    Logger.error('❌ Error refreshing IB balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh IB account balance';
    return res.status(500).json({ error: errorMessage });
  }
});

// Get IB portfolio positions (from database)
router.post('/ib/portfolio', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getPortfolio(userSettings);
    return res.json(result);
  } catch (error) {
    Logger.error('Error getting IB portfolio:', error);
    return res.status(500).json({ error: 'Failed to get IB portfolio' });
  }
});

// Force refresh IB portfolio
router.post('/ib/portfolio/refresh', authenticateToken, async (req, res) => {
  try {
    Logger.info('🔄 Force refresh portfolio endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshPortfolio(userSettings);
    
    // Recalculate today's performance snapshot after portfolio update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      Logger.info(`📈 Updated performance snapshot after portfolio refresh`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    Logger.info('✅ Portfolio refresh successful, returning data');
    return res.json(result);
  } catch (error) {
    Logger.error('❌ Error refreshing IB portfolio:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh IB portfolio';
    return res.status(500).json({ error: errorMessage });
  }
});

// Get all account data (cached)
router.post('/ib/account-data', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getAccountData(userSettings);
    return res.json(result);
  } catch (error) {
    Logger.error('Error getting IB account data:', error);
    return res.status(500).json({ error: 'Failed to get IB account data' });
  }
});

// Force refresh all account data
router.post('/ib/refresh-all', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshAll(userSettings);
    
    // Update the main account balance and balance history if target account is configured
    if (userSettings.target_account_id && result.balance) {
      try {
        const { AccountModel } = await import('../models/Account.js');
        
        // Update the account's current balance
        await AccountModel.update(userSettings.target_account_id, userId, {
          currentBalance: result.balance.balance
        });
        
        // Add balance history entry for the manual refresh
        await AccountModel.addBalanceHistory(
          userSettings.target_account_id, 
          result.balance.balance, 
          'Manual IB full refresh'
        );
        
        Logger.info(`💰 Updated account balance: ${result.balance.balance} ${result.balance.currency}`);
      } catch (accountError) {
        Logger.error(`❌ Failed to update account balance:`, accountError);
      }
    }
    
    // Recalculate today's performance snapshot after full refresh
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      Logger.info(`📈 Updated performance snapshot after full refresh`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.json(result);
  } catch (error) {
    Logger.error('Error refreshing all IB data:', error);
    return res.status(500).json({ error: 'Failed to refresh all IB data' });
  }
});

// Get cache status (for debugging)
router.get('/ib/data-status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings to get target_account_id
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings || !userSettings.target_account_id) {
      return res.status(400).json({ error: 'IB connection not configured or target account not set' });
    }
    
    const status = await IBService.getDataStats(userSettings.target_account_id);
    return res.json(status);
  } catch (error) {
    Logger.error('Error getting data status:', error);
    return res.status(500).json({ error: 'Failed to get data status' });
  }
});

// Test database data loading endpoint
router.get('/ib/test-data', authenticateToken, async (req, res) => {
  try {
    Logger.info('🧪 Testing database data loading...');
    const userId = (req as any).user.id;

    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }

    const balance = await IBService.getAccountBalance(userSettings);
    const portfolio = await IBService.getPortfolio(userSettings);
    return res.json({
      balance,
      portfolio,
      dataStatus: userSettings.target_account_id ? await IBService.getDataStats(userSettings.target_account_id) : null
    });
  } catch (error) {
    Logger.error('Error testing database data:', error);
    return res.status(500).json({ error: 'Failed to test database data' });
  }
});

// Force cleanup IB subscriptions (use if you get "maximum requests exceeded")
router.post('/ib/cleanup', authenticateToken, async (req, res) => {
  try {
    await IBService.forceCleanup();
    return res.json({ success: true, message: 'IB subscriptions cleaned up' });
  } catch (error) {
    Logger.error('Error cleaning up IB subscriptions:', error);
    return res.status(500).json({ error: 'Failed to cleanup IB subscriptions' });
  }
});

// Get IB cash balances (from database)
router.post('/ib/cash', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getCashBalances(userSettings);
    const timestamp = userSettings.target_account_id ? await IBService.getCashTimestamp(userSettings.target_account_id) : null;
    return res.json({ data: result, timestamp });
  } catch (error) {
    Logger.error('Error getting IB cash balances:', error);
    return res.status(500).json({ error: 'Failed to get IB cash balances' });
  }
});

// Force refresh IB cash balances
router.post('/ib/cash/refresh', authenticateToken, async (req, res) => {
  try {
    Logger.info('🔄 Force refresh cash balances endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshCashBalances(userSettings);
    
    // Recalculate today's performance snapshot after cash balances update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      Logger.info(`📈 Updated performance snapshot after cash balances refresh`);
    } catch (performanceError) {
      Logger.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    const timestamp = userSettings.target_account_id ? await IBService.getCashTimestamp(userSettings.target_account_id) : null;
    Logger.info('✅ Cash balances refresh successful, returning data');
    return res.json({ data: result, timestamp });
  } catch (error) {
    Logger.error('❌ Error refreshing IB cash balances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh IB cash balances';
    return res.status(500).json({ error: errorMessage });
  }
});



// Disconnect from IB Gateway
router.post('/ib/disconnect', authenticateToken, async (req, res) => {
  try {
    await IBService.disconnect();
    return res.json({ success: true, message: 'Disconnected from IB Gateway' });
  } catch (error) {
    Logger.error('Error disconnecting from IB:', error);
    return res.status(500).json({ error: 'Failed to disconnect from IB Gateway' });
  }
});

export default router;