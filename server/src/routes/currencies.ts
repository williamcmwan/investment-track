import express from 'express';
import { z } from 'zod';
import { CurrencyPairModel, CreateCurrencyPairData, UpdateCurrencyPairData } from '../models/CurrencyPair.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { ExchangeRateService } from '../services/exchangeRateService.js';


const router = express.Router();

// Get popular currency pairs (public endpoint - no auth required)
router.get('/popular-pairs', async (req, res) => {
  try {
    // Get user's base currency from query parameter or default to HKD
    const baseCurrency = req.query.baseCurrency as string || 'HKD';
    const popularPairs = ExchangeRateService.getPopularPairs(baseCurrency);
    return res.json(popularPairs);
  } catch (error) {
    console.error('Get popular pairs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get last update time for exchange rates (public endpoint)
router.get('/last-update', async (req, res) => {
  try {
    const lastUpdate = await ExchangeRateService.getLastUpdateTime();
    return res.json({ 
      lastUpdate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get last update time error:', error);
    return res.status(500).json({ error: 'Failed to get last update time' });
  }
});

// Get comprehensive last update times for all data types (public endpoint)
router.get('/all-last-updates', async (req, res) => {
  try {
    const { LastUpdateService } = await import('../services/lastUpdateService.js');
    const allUpdates = LastUpdateService.getAllLastUpdateTimes();
    return res.json({
      ...allUpdates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get all last update times error:', error);
    return res.status(500).json({ error: 'Failed to get last update times' });
  }
});

// Get exchange rate for a specific pair (public endpoint - no auth required)
router.get('/public-rate/:pair', async (req, res) => {
  try {
    const encodedPair = req.params.pair;
    const pair = decodeURIComponent(encodedPair);
    if (!pair || !pair.includes('/')) {
      return res.status(400).json({ error: 'Invalid currency pair format' });
    }
    
    const [fromCurrency, toCurrency] = pair.split('/');
    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({ error: 'Invalid currency pair format' });
    }
    const rate = await ExchangeRateService.getExchangeRate(fromCurrency, toCurrency);
    
    return res.json({ 
      pair, 
      rate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    return res.status(500).json({ error: 'Failed to get exchange rate' });
  }
});

// Apply authentication to all routes after this point
router.use(authenticateToken);

// Update all currency pairs with enhanced exchange rates (multiple sources)
router.post('/update-rates-enhanced', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    await ExchangeRateService.updateAllCurrencyPairs(userId, true); // Force refresh for manual updates
    
    // Recalculate today's performance snapshot after currency update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      console.log(`📈 Updated performance snapshot after enhanced currency refresh`);
    } catch (performanceError) {
      console.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    // Return updated pairs for the authenticated user
    const pairs = await CurrencyPairModel.findByUserId(userId);
    return res.json({ 
      message: 'Enhanced exchange rates updated successfully',
      pairs,
      accuracy: 'Multi-source weighted average'
    });
  } catch (error) {
    console.error('Update enhanced exchange rates error:', error);
    return res.status(500).json({ error: 'Failed to update enhanced exchange rates' });
  }
});

// Validation schemas
const createCurrencyPairSchema = z.object({
  pair: z.string().min(5).max(10), // e.g., "USD/HKD"
  avgCost: z.number().positive(),
  amount: z.number().positive()
});

const updateCurrencyPairSchema = z.object({
  currentRate: z.number().positive().optional(),
  avgCost: z.number().positive().optional(),
  amount: z.number().positive().optional()
});

// Get all currency pairs for user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    const refresh = (req.query.refresh === '1' || req.query.refresh === 'true');

    // If refresh requested, update all pairs first (multi-source enhanced accuracy)
    if (refresh) {
      try {
        await ExchangeRateService.updateAllCurrencyPairs(userId, true); // Force refresh when explicitly requested
      } catch (e) {
        console.warn('Currency refresh failed, returning cached pairs instead');
      }
    }

    const pairs = await CurrencyPairModel.findByUserId(userId);
    return res.json(pairs);
  } catch (error) {
    console.error('Get currency pairs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific currency pair
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const pair = await CurrencyPairModel.findById(pairId, req.user?.id || 0);
    if (!pair) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    return res.json(pair);
  } catch (error) {
    console.error('Get currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new currency pair
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createCurrencyPairSchema.parse(req.body);
    
    // Get current exchange rate for the pair
    const [fromCurrency, toCurrency] = validatedData.pair.split('/');
    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({ error: 'Invalid currency pair format' });
    }
    const currentRate = await ExchangeRateService.getExchangeRate(fromCurrency, toCurrency);
    
    const pairData = {
      ...validatedData,
      currentRate
    };
    
    const pair = await CurrencyPairModel.create(req.user?.id || 0, pairData as CreateCurrencyPairData);
    
    // Recalculate today's performance snapshot after currency pair creation
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      console.log(`📈 Updated performance snapshot after currency pair creation`);
    } catch (performanceError) {
      console.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.status(201).json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Create currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update currency pair
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const validatedData = updateCurrencyPairSchema.parse(req.body);
    
    const pair = await CurrencyPairModel.update(pairId, req.user?.id || 0, validatedData as UpdateCurrencyPairData);
    if (!pair) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    // Recalculate today's performance snapshot after currency pair update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      console.log(`📈 Updated performance snapshot after currency pair update`);
    } catch (performanceError) {
      console.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    console.error('Update currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete currency pair
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const pairId = parseInt(req.params.id || '0');
    if (isNaN(pairId)) {
      return res.status(400).json({ error: 'Invalid currency pair ID' });
    }
    
    const deleted = await CurrencyPairModel.delete(pairId, req.user?.id || 0);
    if (!deleted) {
      return res.status(404).json({ error: 'Currency pair not found' });
    }
    
    // Recalculate today's performance snapshot after currency pair deletion
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(req.user?.id || 0);
      console.log(`📈 Updated performance snapshot after currency pair deletion`);
    } catch (performanceError) {
      console.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    return res.json({ message: 'Currency pair deleted successfully' });
  } catch (error) {
    console.error('Delete currency pair error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update all currency pairs with latest exchange rates
router.post('/update-rates', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || 0;
    await ExchangeRateService.updateAllCurrencyPairs(userId, true); // Force refresh for manual updates
    
    // Recalculate today's performance snapshot after currency update
    try {
      const { PerformanceHistoryService } = await import('../services/performanceHistoryService.js');
      await PerformanceHistoryService.calculateTodaySnapshot(userId);
      console.log(`📈 Updated performance snapshot after currency refresh`);
    } catch (performanceError) {
      console.error(`❌ Failed to update performance snapshot:`, performanceError);
    }
    
    // Return updated pairs
    const pairs = await CurrencyPairModel.findByUserId(userId);
    return res.json({ 
      message: 'Exchange rates updated successfully',
      pairs 
    });
  } catch (error) {
    console.error('Update exchange rates error:', error);
    return res.status(500).json({ error: 'Failed to update exchange rates' });
  }
});


export default router;
