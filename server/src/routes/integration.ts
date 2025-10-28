import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { IBService } from '../services/ibService.js';
import { IBConnectionService } from '../services/ibConnectionService.js';

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
    console.error('Error getting IB settings:', error);
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
    console.error('Error saving IB settings:', error);
    return res.status(500).json({ error: 'Failed to save IB settings' });
  }
});

// Get IB account balance (cached)
router.post('/ib/balance', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getAccountBalance(userSettings);
    const timestamp = IBService.getBalanceTimestamp();
    return res.json({ ...result, timestamp });
  } catch (error) {
    console.error('Error getting IB balance:', error);
    return res.status(500).json({ error: 'Failed to get IB account balance' });
  }
});

// Force refresh IB account balance
router.post('/ib/balance/refresh', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Force refresh balance endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshAccountBalance(userSettings);
    const timestamp = IBService.getBalanceTimestamp();
    console.log('✅ Balance refresh successful, returning data');
    return res.json({ ...result, timestamp });
  } catch (error) {
    console.error('❌ Error refreshing IB balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh IB account balance';
    return res.status(500).json({ error: errorMessage });
  }
});

// Get IB portfolio positions (cached)
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
    console.error('Error getting IB portfolio:', error);
    return res.status(500).json({ error: 'Failed to get IB portfolio' });
  }
});

// Force refresh IB portfolio
router.post('/ib/portfolio/refresh', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Force refresh portfolio endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshPortfolio(userSettings);
    console.log('✅ Portfolio refresh successful, returning data');
    return res.json(result);
  } catch (error) {
    console.error('❌ Error refreshing IB portfolio:', error);
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
    console.error('Error getting IB account data:', error);
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
    return res.json(result);
  } catch (error) {
    console.error('Error refreshing all IB data:', error);
    return res.status(500).json({ error: 'Failed to refresh all IB data' });
  }
});

// Get cache status (for debugging)
router.get('/ib/cache-status', authenticateToken, async (req, res) => {
  try {
    const status = IBService.getCacheStatus();
    return res.json(status);
  } catch (error) {
    console.error('Error getting cache status:', error);
    return res.status(500).json({ error: 'Failed to get cache status' });
  }
});

// Test cache loading endpoint
router.get('/ib/test-cache', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Testing cache loading...');
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
      cacheStatus: IBService.getCacheStatus()
    });
  } catch (error) {
    console.error('Error testing cache:', error);
    return res.status(500).json({ error: 'Failed to test cache' });
  }
});

// Force cleanup IB subscriptions (use if you get "maximum requests exceeded")
router.post('/ib/cleanup', authenticateToken, async (req, res) => {
  try {
    await IBService.forceCleanup();
    return res.json({ success: true, message: 'IB subscriptions cleaned up' });
  } catch (error) {
    console.error('Error cleaning up IB subscriptions:', error);
    return res.status(500).json({ error: 'Failed to cleanup IB subscriptions' });
  }
});

// Get IB cash balances (cached)
router.post('/ib/cash', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.getCashBalances(userSettings);
    const timestamp = IBService.getCashTimestamp();
    return res.json({ data: result, timestamp });
  } catch (error) {
    console.error('Error getting IB cash balances:', error);
    return res.status(500).json({ error: 'Failed to get IB cash balances' });
  }
});

// Force refresh IB cash balances
router.post('/ib/cash/refresh', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Force refresh cash balances endpoint called');
    const userId = (req as any).user.id;
    
    // Get user's IB settings
    const userSettings = await IBConnectionService.getUserIBSettings(userId);
    
    if (!userSettings) {
      return res.status(400).json({ error: 'IB connection not configured. Please configure your IB settings first.' });
    }
    
    const result = await IBService.forceRefreshCashBalances(userSettings);
    const timestamp = IBService.getCashTimestamp();
    console.log('✅ Cash balances refresh successful, returning data');
    return res.json({ data: result, timestamp });
  } catch (error) {
    console.error('❌ Error refreshing IB cash balances:', error);
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
    console.error('Error disconnecting from IB:', error);
    return res.status(500).json({ error: 'Failed to disconnect from IB Gateway' });
  }
});

export default router;