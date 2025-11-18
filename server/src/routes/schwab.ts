import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { SchwabService } from '../services/schwabService.js';
import { Logger } from '../utils/logger.js';
import { AccountModel } from '../models/Account.js';
import { PerformanceHistoryService } from '../services/performanceHistoryService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get Schwab settings for the current user
 */
router.get('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const settings = await SchwabService.getUserSettings(userId);
    
    if (settings) {
      // Don't send sensitive tokens to client
      return res.json({
        app_key: settings.app_key,
        has_tokens: !!(settings.access_token && settings.refresh_token)
      });
    } else {
      return res.json({
        app_key: '',
        has_tokens: false
      });
    }
  } catch (error) {
    Logger.error('Error getting Schwab settings:', error);
    return res.status(500).json({ error: 'Failed to get Schwab settings' });
  }
});

/**
 * Save Schwab API credentials
 */
router.post('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const { app_key, app_secret } = req.body;
    
    if (!app_key || !app_secret) {
      return res.status(400).json({ error: 'App Key and App Secret are required' });
    }
    
    await SchwabService.saveUserSettings(userId, {
      app_key,
      app_secret
    });
    
    Logger.info(`✅ Saved Schwab settings for user ${userId}`);
    return res.json({ success: true, message: 'Schwab settings saved successfully' });
  } catch (error) {
    Logger.error('Error saving Schwab settings:', error);
    return res.status(500).json({ error: 'Failed to save Schwab settings' });
  }
});

/**
 * Save OAuth tokens after user completes authentication
 */
router.post('/tokens', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const { access_token, refresh_token, expires_in } = req.body;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: 'Access token and refresh token are required' });
    }
    
    const settings = await SchwabService.getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure Schwab settings first' });
    }
    
    const expires_at = Math.floor(Date.now() / 1000) + (expires_in || 1800); // Default 30 minutes
    
    await SchwabService.saveUserSettings(userId, {
      app_key: settings.app_key,
      app_secret: settings.app_secret,
      access_token,
      refresh_token,
      token_expires_at: expires_at
    });
    
    Logger.info(`✅ Saved Schwab OAuth tokens for user ${userId}`);
    return res.json({ success: true, message: 'OAuth tokens saved successfully' });
  } catch (error) {
    Logger.error('Error saving Schwab tokens:', error);
    return res.status(500).json({ error: 'Failed to save OAuth tokens' });
  }
});

/**
 * Get all account numbers
 */
router.get('/accounts', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const accounts = await SchwabService.getAccountNumbers(userId);
    
    return res.json(accounts);
  } catch (error: any) {
    Logger.error('Error getting Schwab accounts:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get Schwab accounts' 
    });
  }
});

/**
 * Get account balance and refresh the linked account
 */
router.get('/accounts/:accountHash/balance', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const { accountHash } = req.params;
    const { accountId } = req.query; // Optional: linked account ID in our system
    
    if (!accountHash) {
      return res.status(400).json({ error: 'Account hash is required' });
    }
    
    const balance = await SchwabService.getAccountBalance(userId, accountHash);
    
    // If accountId is provided, update the linked account balance
    if (accountId) {
      const linkedAccountId = parseInt(accountId as string);
      if (!isNaN(linkedAccountId)) {
        try {
          await AccountModel.update(linkedAccountId, userId, {
            currentBalance: balance.currentBalance
          });
          
          await AccountModel.addBalanceHistory(
            linkedAccountId,
            balance.currentBalance,
            'Schwab API refresh'
          );
          
          // Recalculate today's performance snapshot
          await PerformanceHistoryService.calculateTodaySnapshot(userId);
          
          Logger.info(`✅ Updated account ${linkedAccountId} with Schwab balance: ${balance.currentBalance}`);
        } catch (updateError) {
          Logger.error('Failed to update linked account:', updateError);
        }
      }
    }
    
    return res.json(balance);
  } catch (error: any) {
    Logger.error('Error getting Schwab account balance:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get account balance' 
    });
  }
});

/**
 * Get positions for an account
 */
router.get('/accounts/:accountHash/positions', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const { accountHash } = req.params;
    
    if (!accountHash) {
      return res.status(400).json({ error: 'Account hash is required' });
    }
    
    const positions = await SchwabService.getPositions(userId, accountHash);
    
    return res.json(positions);
  } catch (error: any) {
    Logger.error('Error getting Schwab positions:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get positions' 
    });
  }
});

/**
 * Get quotes for symbols
 */
router.post('/quotes', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }
    
    const quotes = await SchwabService.getQuotes(userId, symbols);
    
    return res.json(quotes);
  } catch (error: any) {
    Logger.error('Error getting Schwab quotes:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get quotes' 
    });
  }
});

export default router;
