import { Logger } from '../utils/logger.js';

export interface MarketData {
  symbol: string;
  marketPrice: number;
  closePrice: number;
  dayChange: number;
  dayChangePercent: number;
  currency: string;
  marketState: string;
  shortName?: string | undefined;
  longName?: string | undefined;
  sector?: string | undefined;
  industry?: string | undefined;
  country?: string | undefined;
  exchange?: string | undefined;
  lastUpdated: Date;
}

export class YahooFinanceService {
  // Cache for market data (5 minute cache)
  private static marketDataCache = new Map<string, { data: MarketData; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Track last request time for rate limiting
  private static lastRequestTime = 0;
  private static readonly MIN_REQUEST_INTERVAL = 300; // 300ms between individual requests
  
  // Yahoo Finance direct API (same as exchange rate service - more reliable)
  private static readonly YAHOO_CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart';

  /**
   * Get market data using direct Yahoo Finance chart API (more reliable than yahoo-finance2 library)
   */
  static async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Check cache first
      const cached = this.marketDataCache.get(symbol);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        Logger.debug(`📊 Using cached Yahoo Finance data for ${symbol}`);
        return cached.data;
      }

      // Rate limiting: ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();

      Logger.debug(`📊 Fetching Yahoo Finance data for ${symbol} using direct API...`);
      
      // Use direct chart API (same approach as exchange rate service which works reliably)
      const url = `${this.YAHOO_CHART_API}/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        Logger.error(`❌ Yahoo Finance API request failed for ${symbol}: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        Logger.debug(`❌ No data found for symbol ${symbol}`);
        return null;
      }
      
      const result = data.chart.result[0];
      const meta = result.meta;
      const quotes = result.indicators?.quote?.[0];
      
      if (!meta) {
        Logger.debug(`❌ No meta data for symbol ${symbol}`);
        return null;
      }
      
      // Get current price and previous close
      const marketPrice = meta.regularMarketPrice || 0;
      const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
      
      // Calculate day change
      const dayChange = previousClose > 0 ? marketPrice - previousClose : 0;
      const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;

      const marketData: MarketData = {
        symbol: meta.symbol || symbol,
        marketPrice: marketPrice,
        closePrice: previousClose,
        dayChange: dayChange,
        dayChangePercent: dayChangePercent,
        currency: meta.currency || 'USD',
        marketState: meta.marketState || 'UNKNOWN',
        shortName: meta.shortName || undefined,
        longName: meta.longName || undefined,
        exchange: meta.exchangeName || meta.exchange || undefined,
        lastUpdated: new Date()
      };

      // Cache the result
      this.marketDataCache.set(symbol, {
        data: marketData,
        timestamp: Date.now()
      });

      Logger.debug(`✅ Got Yahoo Finance data for ${symbol}: price=${marketData.marketPrice}, prevClose=${marketData.closePrice}`);
      return marketData;

    } catch (error: any) {
      Logger.error(`❌ Error fetching Yahoo Finance data for ${symbol}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Get market data for multiple symbols with rate limiting
   */
  static async getMultipleMarketData(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();
    
    if (symbols.length === 0) return results;

    Logger.info(`📊 Fetching Yahoo Finance data for ${symbols.length} symbols using yahoo-finance2...`);

    // Process symbols in batches with delays to avoid rate limiting (429 errors)
    const batchSize = 5;
    const delayBetweenBatches = 2000; // 2 seconds between batches
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      // Add delay between batches (except for the first batch)
      if (i > 0) {
        Logger.debug(`⏱️ Waiting ${delayBetweenBatches}ms before next batch to avoid rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
      
      // Process batch concurrently
      const batchPromises = batch.map(async (symbol) => {
        try {
          const data = await this.getMarketData(symbol);
          if (data) {
            results.set(symbol, data);
          }
        } catch (error) {
          Logger.error(`❌ Failed to fetch data for ${symbol}:`, error);
        }
      });
      
      await Promise.all(batchPromises);
      Logger.debug(`📊 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`);
    }

    Logger.info(`✅ Got Yahoo Finance data for ${results.size}/${symbols.length} symbols using yahoo-finance2`);
    return results;
  }

  /**
   * Search for symbols (for autocomplete) - using direct Yahoo Finance API
   */
  static async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
    try {
      Logger.debug(`🔍 Searching for symbols matching: ${query}`);
      
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        Logger.error(`❌ Yahoo Finance search failed: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      const results = data.quotes?.map((quote: any) => ({
        symbol: quote.symbol || '',
        name: quote.shortname || quote.longname || '',
        type: quote.quoteType || 'EQUITY',
        exchange: quote.exchange || ''
      })) || [];

      Logger.debug(`✅ Found ${results.length} symbols for query: ${query}`);
      return results.slice(0, 10); // Limit to 10 results

    } catch (error) {
      Logger.error(`❌ Error searching symbols for ${query}:`, error);
      return [];
    }
  }
}