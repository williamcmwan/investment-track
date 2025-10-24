import axios from 'axios';

interface YahooQuoteData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  currency: string;
  marketState: string;
  quoteType: string;
  shortName?: string;
  longName?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
}

interface YahooFinanceResponse {
  quoteResponse: {
    result: YahooQuoteData[];
    error: any;
  };
}

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
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
  private static readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  
  // Cache for market data (5 minute cache)
  private static marketDataCache = new Map<string, { data: MarketData; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get market data for a single symbol
   */
  static async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Check cache first
      const cached = this.marketDataCache.get(symbol);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log(`📊 Using cached Yahoo Finance data for ${symbol}`);
        return cached.data;
      }

      console.log(`📊 Fetching Yahoo Finance data for ${symbol}...`);
      
      const response = await axios.get<YahooFinanceResponse>(this.BASE_URL, {
        params: {
          symbols: symbol,
          fields: 'regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,currency,marketState,quoteType,shortName,longName,sector,industry,country,exchange'
        },
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const result = response.data?.quoteResponse?.result?.[0];
      if (!result) {
        console.log(`❌ No data found for symbol ${symbol}`);
        return null;
      }

      const marketData: MarketData = {
        symbol: result.symbol,
        marketPrice: result.regularMarketPrice || 0,
        closePrice: result.regularMarketPreviousClose || 0,
        dayChange: result.regularMarketChange || 0,
        dayChangePercent: result.regularMarketChangePercent || 0,
        currency: result.currency || 'USD',
        marketState: result.marketState || 'UNKNOWN',
        shortName: result.shortName || undefined,
        longName: result.longName || undefined,
        sector: result.sector || undefined,
        industry: result.industry || undefined,
        country: result.country || undefined,
        exchange: result.exchange || undefined,
        lastUpdated: new Date()
      };

      // Cache the result
      this.marketDataCache.set(symbol, {
        data: marketData,
        timestamp: Date.now()
      });

      console.log(`✅ Got Yahoo Finance data for ${symbol}: $${marketData.marketPrice}`);
      return marketData;

    } catch (error) {
      console.error(`❌ Error fetching Yahoo Finance data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get market data for multiple symbols
   */
  static async getMultipleMarketData(symbols: string[]): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();
    
    if (symbols.length === 0) return results;

    try {
      // Check cache for all symbols first
      const uncachedSymbols: string[] = [];
      const now = Date.now();

      for (const symbol of symbols) {
        const cached = this.marketDataCache.get(symbol);
        if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
          results.set(symbol, cached.data);
        } else {
          uncachedSymbols.push(symbol);
        }
      }

      if (uncachedSymbols.length === 0) {
        console.log(`📊 All symbols found in cache`);
        return results;
      }

      console.log(`📊 Fetching Yahoo Finance data for ${uncachedSymbols.length} symbols...`);

      // Fetch uncached symbols (batch request)
      const response = await axios.get<YahooFinanceResponse>(this.BASE_URL, {
        params: {
          symbols: uncachedSymbols.join(','),
          fields: 'regularMarketPrice,regularMarketPreviousClose,regularMarketChange,regularMarketChangePercent,currency,marketState,quoteType,shortName,longName,sector,industry,country,exchange'
        },
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      const quotes = response.data?.quoteResponse?.result || [];
      
      for (const quote of quotes) {
        const marketData: MarketData = {
          symbol: quote.symbol,
          marketPrice: quote.regularMarketPrice || 0,
          closePrice: quote.regularMarketPreviousClose || 0,
          dayChange: quote.regularMarketChange || 0,
          dayChangePercent: quote.regularMarketChangePercent || 0,
          currency: quote.currency || 'USD',
          marketState: quote.marketState || 'UNKNOWN',
          shortName: quote.shortName || undefined,
          longName: quote.longName || undefined,
          sector: quote.sector || undefined,
          industry: quote.industry || undefined,
          country: quote.country || undefined,
          exchange: quote.exchange || undefined,
          lastUpdated: new Date()
        };

        results.set(quote.symbol, marketData);
        
        // Cache the result
        this.marketDataCache.set(quote.symbol, {
          data: marketData,
          timestamp: now
        });
      }

      console.log(`✅ Fetched Yahoo Finance data for ${quotes.length} symbols`);
      return results;

    } catch (error) {
      console.error(`❌ Error fetching multiple Yahoo Finance data:`, error);
      return results;
    }
  }

  /**
   * Search for symbols (for autocomplete)
   */
  static async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
    try {
      const response = await axios.get('https://query1.finance.yahoo.com/v1/finance/search', {
        params: {
          q: query,
          quotesCount: 10,
          newsCount: 0
        },
        headers: {
          'User-Agent': this.USER_AGENT
        },
        timeout: 5000
      });

      const quotes = response.data?.quotes || [];
      return quotes.map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.symbol,
        type: quote.quoteType || 'EQUITY',
        exchange: quote.exchange || 'UNKNOWN'
      }));

    } catch (error) {
      console.error('Error searching Yahoo Finance symbols:', error);
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  static clearCache(): void {
    this.marketDataCache.clear();
    console.log('📊 Yahoo Finance cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.marketDataCache.size,
      symbols: Array.from(this.marketDataCache.keys())
    };
  }
}