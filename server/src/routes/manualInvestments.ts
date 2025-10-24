import express from 'express';
import { ManualInvestmentService } from '../services/manualInvestmentService';
import { YahooFinanceService } from '../services/yahooFinanceService';

const router = express.Router();

// Initialize database on first load
ManualInvestmentService.initializeDatabase().catch(console.error);



/**
 * GET /api/manual-investments/positions
 * Get all manual positions for the user
 */
router.get('/positions', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default';
    const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
    
    let positions;
    if (accountId) {
      positions = ManualInvestmentService.getManualPositions(accountId);
    } else {
      positions = await ManualInvestmentService.getEnrichedManualPositions(userId);
    }
    
    res.json(positions);
  } catch (error) {
    console.error('Error getting manual positions:', error);
    res.status(500).json({ error: 'Failed to get manual positions' });
  }
});

/**
 * POST /api/manual-investments/positions
 * Add a new manual position
 */
router.post('/positions', async (req, res) => {
  try {
    console.log('📊 Creating position with request body:', req.body);
    
    const {
      accountId, // This will be the main account ID
      symbol,
      secType,
      currency = 'USD',
      country,
      industry,
      category,
      quantity,
      averageCost,
      exchange,
      primaryExchange,
      notes
    } = req.body;
    
    if (!accountId || !symbol || !secType || !quantity || !averageCost) {
      console.log('❌ Validation failed:', { accountId, symbol, secType, quantity, averageCost });
      return res.status(400).json({ 
        error: 'Account ID, symbol, security type, quantity, and average cost are required' 
      });
    }

    const positionData = {
      mainAccountId: parseInt(accountId), // Use mainAccountId
      symbol: symbol.toUpperCase(),
      secType,
      currency,
      country,
      industry,
      category,
      quantity: parseFloat(quantity),
      averageCost: parseFloat(averageCost),
      exchange,
      primaryExchange,
      notes
    };
    
    console.log('📊 Creating position with processed data:', positionData);

    const position = ManualInvestmentService.addManualPosition(positionData);
    
    // Try to get market data immediately
    await ManualInvestmentService.updatePositionMarketData(position.id);
    
    res.status(201).json(position);
  } catch (error) {
    console.error('Error adding manual position:', error);
    res.status(500).json({ error: 'Failed to add manual position' });
  }
});

/**
 * PUT /api/manual-investments/positions/:id
 * Update a manual position
 */
router.put('/positions/:id', async (req, res) => {
  try {
    const positionId = parseInt(req.params.id);
    const updates = req.body;
    
    // Convert numeric fields
    if (updates.quantity) updates.quantity = parseFloat(updates.quantity);
    if (updates.averageCost) updates.averageCost = parseFloat(updates.averageCost);
    if (updates.symbol) updates.symbol = updates.symbol.toUpperCase();
    
    const success = ManualInvestmentService.updateManualPosition(positionId, updates);
    
    if (success) {
      // Update market data if symbol changed
      if (updates.symbol) {
        await ManualInvestmentService.updatePositionMarketData(positionId);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    console.error('Error updating manual position:', error);
    res.status(500).json({ error: 'Failed to update manual position' });
  }
});

/**
 * DELETE /api/manual-investments/positions/:id
 * Delete a manual position
 */
router.delete('/positions/:id', async (req, res) => {
  try {
    const positionId = parseInt(req.params.id);
    const success = ManualInvestmentService.deleteManualPosition(positionId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    console.error('Error deleting manual position:', error);
    res.status(500).json({ error: 'Failed to delete manual position' });
  }
});

/**
 * POST /api/manual-investments/positions/refresh-market-data
 * Refresh market data for all positions
 */
router.post('/positions/refresh-market-data', async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const result = await ManualInvestmentService.updateAllMarketData(userId);
    res.json(result);
  } catch (error) {
    console.error('Error refreshing market data:', error);
    res.status(500).json({ error: 'Failed to refresh market data' });
  }
});

/**
 * GET /api/manual-investments/summary
 * Get portfolio summary for manual accounts
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default';
    const summary = ManualInvestmentService.getManualPortfolioSummary(userId);
    res.json(summary);
  } catch (error) {
    console.error('Error getting portfolio summary:', error);
    res.status(500).json({ error: 'Failed to get portfolio summary' });
  }
});

/**
 * GET /api/manual-investments/search-symbols
 * Search for symbols using Yahoo Finance
 */
router.get('/search-symbols', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 1) {
      return res.json([]);
    }

    const results = await YahooFinanceService.searchSymbols(query);
    res.json(results);
  } catch (error) {
    console.error('Error searching symbols:', error);
    res.status(500).json({ error: 'Failed to search symbols' });
  }
});

/**
 * GET /api/manual-investments/market-data/:symbol
 * Get market data for a specific symbol
 */
router.get('/market-data/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const marketData = await YahooFinanceService.getMarketData(symbol);
    
    if (marketData) {
      res.json(marketData);
    } else {
      res.status(404).json({ error: 'Market data not found for symbol' });
    }
  } catch (error) {
    console.error('Error getting market data:', error);
    res.status(500).json({ error: 'Failed to get market data' });
  }
});

export default router;