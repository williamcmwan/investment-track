import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { IBService } from '../services/ibService.js';

const router = express.Router();

// Get IB connection settings
router.get('/ib/settings', authenticateToken, async (req, res) => {
  try {
    const settings = IBService.getConnectionSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting IB settings:', error);
    res.status(500).json({ error: 'Failed to get IB settings' });
  }
});

// Get IB account balance (cached)
router.post('/ib/balance', authenticateToken, async (req, res) => {
  try {
    const result = await IBService.getAccountBalance();
    res.json(result);
  } catch (error) {
    console.error('Error getting IB balance:', error);
    res.status(500).json({ error: 'Failed to get IB account balance' });
  }
});

// Force refresh IB account balance
router.post('/ib/balance/refresh', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Force refresh balance endpoint called');
    const result = await IBService.forceRefreshAccountBalance();
    res.json(result);
  } catch (error) {
    console.error('Error refreshing IB balance:', error);
    res.status(500).json({ error: 'Failed to refresh IB account balance' });
  }
});

// Get IB portfolio positions (cached)
router.post('/ib/portfolio', authenticateToken, async (req, res) => {
  try {
    const result = await IBService.getPortfolio();
    res.json(result);
  } catch (error) {
    console.error('Error getting IB portfolio:', error);
    res.status(500).json({ error: 'Failed to get IB portfolio' });
  }
});

// Force refresh IB portfolio
router.post('/ib/portfolio/refresh', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Force refresh portfolio endpoint called');
    const result = await IBService.forceRefreshPortfolio();
    res.json(result);
  } catch (error) {
    console.error('Error refreshing IB portfolio:', error);
    res.status(500).json({ error: 'Failed to refresh IB portfolio' });
  }
});

// Get all account data (cached)
router.post('/ib/account-data', authenticateToken, async (req, res) => {
  try {
    const result = await IBService.getAccountData();
    res.json(result);
  } catch (error) {
    console.error('Error getting IB account data:', error);
    res.status(500).json({ error: 'Failed to get IB account data' });
  }
});

// Force refresh all account data
router.post('/ib/refresh-all', authenticateToken, async (req, res) => {
  try {
    const result = await IBService.forceRefreshAll();
    res.json(result);
  } catch (error) {
    console.error('Error refreshing all IB data:', error);
    res.status(500).json({ error: 'Failed to refresh all IB data' });
  }
});

// Get cache status (for debugging)
router.get('/ib/cache-status', authenticateToken, async (req, res) => {
  try {
    const status = IBService.getCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

// Test cache loading endpoint
router.get('/ib/test-cache', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Testing cache loading...');
    const balance = await IBService.getAccountBalance();
    const portfolio = await IBService.getPortfolio();
    res.json({ 
      balance, 
      portfolio,
      cacheStatus: IBService.getCacheStatus()
    });
  } catch (error) {
    console.error('Error testing cache:', error);
    res.status(500).json({ error: 'Failed to test cache' });
  }
});

// Force cleanup IB subscriptions (use if you get "maximum requests exceeded")
router.post('/ib/cleanup', authenticateToken, async (req, res) => {
  try {
    await IBService.forceCleanup();
    res.json({ success: true, message: 'IB subscriptions cleaned up' });
  } catch (error) {
    console.error('Error cleaning up IB subscriptions:', error);
    res.status(500).json({ error: 'Failed to cleanup IB subscriptions' });
  }
});

// Disconnect from IB Gateway
router.post('/ib/disconnect', authenticateToken, async (req, res) => {
  try {
    await IBService.disconnect();
    res.json({ success: true, message: 'Disconnected from IB Gateway' });
  } catch (error) {
    console.error('Error disconnecting from IB:', error);
    res.status(500).json({ error: 'Failed to disconnect from IB Gateway' });
  }
});

export default router;