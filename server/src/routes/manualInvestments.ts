import express from 'express';
import { OtherPortfolioService } from '../services/otherPortfolioService';

const router = express.Router();

// Initialize database on first load
OtherPortfolioService.initializeDatabase().catch(console.error);



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
      positions = OtherPortfolioService.getManualPositions(accountId);
    } else {
      // Use getAllManualPositions instead of getEnrichedManualPositions to avoid auto-refresh
      positions = OtherPortfolioService.getAllManualPositions(userId);
    }
    
    return res.json(positions);
  } catch (error) {
    console.error('Error getting manual positions:', error);
    return res.status(500).json({ error: 'Failed to get manual positions' });
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
      primaryExchange
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
      primaryExchange
    };
    
    console.log('📊 Creating position with processed data:', positionData);

    const position = OtherPortfolioService.addManualPosition(positionData);
    
    // Try to get market data immediately
    await OtherPortfolioService.updatePositionMarketData(position.id);
    
    return res.status(201).json(position);
  } catch (error) {
    console.error('Error adding manual position:', error);
    return res.status(500).json({ error: 'Failed to add manual position' });
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
    if (updates.marketPrice) updates.marketPrice = parseFloat(updates.marketPrice);
    if (updates.symbol) updates.symbol = updates.symbol.toUpperCase();
    
    const success = OtherPortfolioService.updateManualPosition(positionId, updates);
    
    if (success) {
      // Update market data if symbol changed (but not if price was manually set)
      if (updates.symbol && !updates.marketPrice) {
        await OtherPortfolioService.updatePositionMarketData(positionId);
      }
      
      return res.json({ success: true });
    } else {
      return res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    console.error('Error updating manual position:', error);
    return res.status(500).json({ error: 'Failed to update manual position' });
  }
});

/**
 * DELETE /api/manual-investments/positions/:id
 * Delete a manual position
 */
router.delete('/positions/:id', async (req, res) => {
  try {
    const positionId = parseInt(req.params.id);
    const success = OtherPortfolioService.deleteManualPosition(positionId);
    
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
    const result = await OtherPortfolioService.updateAllMarketData(userId);
    
    // Include last refresh time in response
    const lastRefreshTime = OtherPortfolioService.getLastRefreshTime();
    
    res.json({
      ...result,
      lastRefreshTime: lastRefreshTime ? new Date(lastRefreshTime).toISOString() : null
    });
  } catch (error) {
    console.error('Error refreshing market data:', error);
    res.status(500).json({ error: 'Failed to refresh market data' });
  }
});

/**
 * GET /api/manual-investments/refresh-status
 * Get refresh status and last refresh time
 */
router.get('/refresh-status', async (req, res) => {
  try {
    const lastRefreshTime = OtherPortfolioService.getLastRefreshTime();
    const now = Date.now();
    const timeSinceLastRefresh = lastRefreshTime ? now - lastRefreshTime : null;
    const nextAutoRefresh = lastRefreshTime ? lastRefreshTime + (30 * 60 * 1000) : null;
    
    res.json({
      lastRefreshTime: lastRefreshTime ? new Date(lastRefreshTime).toISOString() : null,
      timeSinceLastRefresh,
      nextAutoRefresh: nextAutoRefresh ? new Date(nextAutoRefresh).toISOString() : null,
      autoRefreshEnabled: true
    });
  } catch (error) {
    console.error('Error getting refresh status:', error);
    res.status(500).json({ error: 'Failed to get refresh status' });
  }
});

/**
 * GET /api/manual-investments/all-last-updates
 * Get comprehensive last update times for all data types
 */
router.get('/all-last-updates', async (req, res) => {
  try {
    const { LastUpdateService } = await import('../services/lastUpdateService.js');
    const allUpdates = LastUpdateService.getAllLastUpdateTimes();
    
    res.json({
      ...allUpdates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting all last update times:', error);
    res.status(500).json({ error: 'Failed to get last update times' });
  }
});

/**
 * GET /api/manual-investments/summary
 * Get portfolio summary for manual accounts
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default';
    const summary = OtherPortfolioService.getManualPortfolioSummary(userId);
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

    const { YahooFinanceService } = await import('../services/yahooFinanceService.js');
    const results = await YahooFinanceService.searchSymbols(query);
    
    return res.json(results);
  } catch (error) {
    console.error('Error searching symbols:', error);
    return res.status(500).json({ error: 'Failed to search symbols' });
  }
});

/**
 * GET /api/manual-investments/market-data/:symbol
 * Get market data for a specific symbol
 */
router.get('/market-data/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { YahooFinanceService } = await import('../services/yahooFinanceService.js');
    const marketData = await YahooFinanceService.getMarketData(symbol);
    
    if (marketData) {
      // Determine security type based on symbol and market data
      let secType = 'STK'; // Default to stock
      
      if (symbol.includes('-') && symbol.length > 4) {
        secType = 'STK'; // Likely a stock with class (e.g., BRK-B)
      } else if (marketData.longName?.toLowerCase().includes('etf') || 
                 marketData.shortName?.toLowerCase().includes('etf')) {
        secType = 'ETF';
      } else if (marketData.longName?.toLowerCase().includes('fund') || 
                 marketData.shortName?.toLowerCase().includes('fund')) {
        secType = 'MUTUAL_FUND';
      } else if (marketData.longName?.toLowerCase().includes('bond') || 
                 marketData.shortName?.toLowerCase().includes('bond') ||
                 symbol.includes('TLT') || symbol.includes('IEF')) {
        secType = 'BOND';
      } else if (symbol.includes('BTC') || symbol.includes('ETH') || 
                 marketData.currency === 'BTC' || marketData.currency === 'ETH') {
        secType = 'CRYPTO';
      }
      
      const enhancedData = {
        ...marketData,
        secType,
        marketPrice: marketData.marketPrice,
        currentPrice: marketData.marketPrice // Alias for average cost
      };
      
      return res.json(enhancedData);
    } else {
      return res.status(404).json({ error: 'Market data not found for symbol' });
    }
  } catch (error) {
    console.error('Error getting market data:', error);
    return res.status(500).json({ error: 'Failed to get market data' });
  }
});

export default router;