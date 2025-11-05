import YahooFinance from 'yahoo-finance2';
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
  
  // Yahoo Finance instance
  private static yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

  /**
   * Get market data using yahoo-finance2 library
   */
  static async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Check cache first
      const cached = this.marketDataCache.get(symbol);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        Logger.debug(`📊 Using cached Yahoo Finance data for ${symbol}`);
        return cached.data;
      }

      Logger.debug(`📊 Fetching Yahoo Finance data for ${symbol} using yahoo-finance2...`);
      
      // Use yahoo-finance2 quote method for basic data
      const quote = await this.yf.quote(symbol);
      
      if (!quote) {
        Logger.debug(`❌ No data found for symbol ${symbol}`);
        return null;
      }

      let sector, industry, country;
      
      // Try to get detailed company information using quoteSummary
      try {
        Logger.debug(`📊 Fetching detailed company info for ${symbol}...`);
        const quoteSummary = await this.yf.quoteSummary(symbol, {
          modules: ['assetProfile', 'summaryProfile']
        });
        
        if (quoteSummary?.assetProfile) {
          sector = quoteSummary.assetProfile.sector;
          industry = quoteSummary.assetProfile.industry;
          country = quoteSummary.assetProfile.country;
        } else if (quoteSummary?.summaryProfile) {
          sector = quoteSummary.summaryProfile.sector;
          industry = quoteSummary.summaryProfile.industry;
          country = quoteSummary.summaryProfile.country;
        }
        
        Logger.debug(`📊 Company info for ${symbol}:`, { sector, industry, country });
      } catch (profileError) {
        Logger.debug(`⚠️ Could not fetch detailed company info for ${symbol}, using basic data only`);
      }

      const marketData: MarketData = {
        symbol: quote.symbol || symbol,
        marketPrice: quote.regularMarketPrice || 0,
        closePrice: quote.regularMarketPreviousClose || 0,
        dayChange: quote.regularMarketChange || 0,
        dayChangePercent: quote.regularMarketChangePercent || 0,
        currency: quote.currency || 'USD',
        marketState: quote.marketState || 'UNKNOWN',
        shortName: quote.shortName || undefined,
        longName: quote.longName || undefined,
        sector: sector || (quote as any).sector || undefined,
        industry: industry || (quote as any).industry || undefined,
        country: country || (quote as any).country || undefined,
        exchange: quote.fullExchangeName || quote.exchange || undefined,
        lastUpdated: new Date()
      };

      // Cache the result
      this.marketDataCache.set(symbol, {
        data: marketData,
        timestamp: Date.now()
      });

      Logger.debug(`✅ Got Yahoo Finance data for ${symbol}: ${marketData.marketPrice} (${marketData.sector || 'No sector'}, ${marketData.industry || 'No industry'}, ${marketData.country || 'No country'})`);
      return marketData;

    } catch (error: any) {
      Logger.error(`❌ Error fetching Yahoo Finance data with yahoo-finance2 for ${symbol}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Get market data for multiple symbols
   */
  static async getMultipleMarketData(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();
    
    if (symbols.length === 0) return results;

    Logger.info(`📊 Fetching Yahoo Finance data for ${symbols.length} symbols using yahoo-finance2...`);

    // Process symbols individually for better error handling
    for (const symbol of symbols) {
      try {
        const data = await this.getMarketData(symbol);
        if (data) {
          results.set(symbol, data);
        }
      } catch (error) {
        Logger.error(`❌ Failed to fetch data for ${symbol}:`, error);
      }
    }

    Logger.info(`✅ Got Yahoo Finance data for ${results.size}/${symbols.length} symbols using yahoo-finance2`);
    return results;
  }

  /**
   * Search for symbols (for autocomplete)
   */
  static async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
    try {
      Logger.debug(`🔍 Searching for symbols matching: ${query}`);
      
      const searchResults = await this.yf.search(query);
      
      const results = searchResults.quotes?.map((quote: any) => ({
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