import { dbRun, dbGet, dbAll } from '../database/connection.js';
import { LastUpdateService } from './lastUpdateService.js';

interface ExchangeRate {
  pair: string;
  rate: number;
  timestamp: string;
}

interface CurrencyPair {
  id: number;
  userId: number;
  pair: string;
  currentRate: number;
  avgCost: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export class ExchangeRateService {
  private static readonly YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (Yahoo Finance updates frequently)
  private static readonly FORCE_UPDATE_DURATION = 15 * 60 * 1000; // 15 minutes - force update even if cached

  /**
   * Fetch exchange rate from Yahoo Finance for a specific currency pair
   */
  static async fetchYahooFinanceRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // Yahoo Finance uses symbols like "USDHKD=X" for USD/HKD
      const symbol = `${fromCurrency}${toCurrency}=X`;
      const url = `${this.YAHOO_FINANCE_BASE}/${symbol}`;
      
      console.log(`Fetching ${fromCurrency}/${toCurrency} rate from Yahoo Finance...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error('Invalid Yahoo Finance response format');
      }
      
      const result = data.chart.result[0];
      const meta = result.meta;
      
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        throw new Error('No valid price data from Yahoo Finance');
      }
      
      const rate = meta.regularMarketPrice;
      console.log(`Successfully fetched ${fromCurrency}/${toCurrency} rate: ${rate}`);
      return rate;
    } catch (error) {
      console.error(`Error fetching ${fromCurrency}/${toCurrency} from Yahoo Finance:`, error);
      throw error;
    }
  }

  /**
   * Fetch exchange rates from multiple sources (Yahoo Finance primary, fallback to exchangerate-api)
   */
  static async fetchLatestRates(): Promise<Record<string, number>> {
    try {
      console.log('Fetching latest exchange rates from Yahoo Finance...');
      
      // Common currency pairs to fetch
      const commonPairs = [
        { from: 'USD', to: 'HKD' },
        { from: 'USD', to: 'EUR' },
        { from: 'USD', to: 'GBP' },
        { from: 'USD', to: 'JPY' },
        { from: 'USD', to: 'CAD' },
        { from: 'USD', to: 'AUD' },
        { from: 'USD', to: 'SGD' },
        { from: 'EUR', to: 'HKD' },
        { from: 'GBP', to: 'HKD' },
        { from: 'JPY', to: 'HKD' }
      ];
      
      const rates: Record<string, number> = {};
      
      // Fetch rates from Yahoo Finance
      for (const pair of commonPairs) {
        try {
          const rate = await this.fetchYahooFinanceRate(pair.from, pair.to);
          rates[`${pair.from}/${pair.to}`] = rate;
          
          // Also store the inverse rate
          rates[`${pair.to}/${pair.from}`] = 1 / rate;
        } catch (error) {
          console.warn(`Failed to fetch ${pair.from}/${pair.to} from Yahoo Finance:`, error);
        }
      }
      
      // If we didn't get enough rates, fallback to exchangerate-api
      if (Object.keys(rates).length < 5) {
        console.log('Falling back to exchangerate-api for missing rates...');
        try {
          const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          if (response.ok) {
            const data = await response.json();
            if (data.rates) {
              // Add missing rates from exchangerate-api
              const fallbackRates = data.rates;
              const missingPairs = [
                { from: 'USD', to: 'HKD' },
                { from: 'USD', to: 'EUR' },
                { from: 'USD', to: 'GBP' },
                { from: 'USD', to: 'JPY' },
                { from: 'USD', to: 'CAD' },
                { from: 'USD', to: 'AUD' },
                { from: 'USD', to: 'SGD' }
              ];
              
              for (const pair of missingPairs) {
                const key = `${pair.from}/${pair.to}`;
                if (!rates[key] && fallbackRates[pair.to]) {
                  rates[key] = fallbackRates[pair.to];
                  rates[`${pair.to}/${pair.from}`] = 1 / fallbackRates[pair.to];
                }
              }
            }
          }
        } catch (fallbackError) {
          console.error('Fallback to exchangerate-api also failed:', fallbackError);
        }
      }
      
      console.log(`Successfully fetched ${Object.keys(rates).length} exchange rates`);
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  /**
   * Get exchange rate for a specific pair using Yahoo Finance
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // If same currency, return 1
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check cache first
      const cached = await this.getCachedRate(fromCurrency, toCurrency);
      
      // If no cached rate exists, or cache is invalid, or should force update, fetch fresh rate
      if (!cached || !this.isCacheValid(cached.timestamp) || this.shouldForceUpdate(cached.timestamp)) {
        console.log(`${!cached ? 'No cached rate found' : 'Cache expired'} for ${fromCurrency}/${toCurrency}, fetching fresh rate...`);
      } else {
        // Use cached rate if valid
        return cached.rate;
      }

      let rate: number;

      try {
        // Try Yahoo Finance first for direct pair
        rate = await this.fetchYahooFinanceRate(fromCurrency, toCurrency);
      } catch (yahooError) {
        console.warn(`Yahoo Finance failed for ${fromCurrency}/${toCurrency}, trying fallback...`);
        
        // Fallback: try to get rate through USD conversion
        try {
          if (fromCurrency === 'USD') {
            // Try to get USD/toCurrency from Yahoo Finance
            rate = await this.fetchYahooFinanceRate('USD', toCurrency);
          } else if (toCurrency === 'USD') {
            // Try to get fromCurrency/USD from Yahoo Finance
            rate = await this.fetchYahooFinanceRate(fromCurrency, 'USD');
          } else {
            // Convert through USD
            const fromToUSD = await this.fetchYahooFinanceRate(fromCurrency, 'USD');
            const usdToTarget = await this.fetchYahooFinanceRate('USD', toCurrency);
            rate = fromToUSD * usdToTarget;
          }
        } catch (fallbackError) {
          console.warn(`Yahoo Finance fallback failed, using exchangerate-api...`);
          
          // Final fallback to exchangerate-api
          const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          if (response.ok) {
            const data = await response.json();
            if (data.rates) {
              if (fromCurrency === 'USD') {
                rate = data.rates[toCurrency] || 1;
              } else if (toCurrency === 'USD') {
                rate = 1 / (data.rates[fromCurrency] || 1);
              } else {
                const fromToUSD = 1 / (data.rates[fromCurrency] || 1);
                const usdToTarget = data.rates[toCurrency] || 1;
                rate = fromToUSD * usdToTarget;
              }
            } else {
              throw new Error('No rates data from fallback API');
            }
          } else {
            throw new Error('Fallback API request failed');
          }
        }
      }

      // Cache the result
      await this.cacheRate(fromCurrency, toCurrency, rate);
      
      return rate;
    } catch (error) {
      console.error(`Error getting exchange rate for ${fromCurrency}/${toCurrency}:`, error);
      return 1; // Fallback to 1:1
    }
  }

  /**
   * Update all currency pairs with latest rates using Yahoo Finance
   */
  static async updateAllCurrencyPairs(userId: number, forceRefresh: boolean = false): Promise<void> {
    try {
      console.log(`Updating currency pairs for user ${userId} with Yahoo Finance...`);
      
      // Get all currency pairs for the user
      const pairs = await dbAll(
        'SELECT id, pair, current_rate FROM currency_pairs WHERE user_id = ?',
        [userId]
      ) as CurrencyPair[];

      if (pairs.length === 0) {
        console.log('No currency pairs to update');
        return;
      }

      // Update each pair individually using Yahoo Finance
      for (const pair of pairs) {
        const [fromCurrency, toCurrency] = pair.pair.split('/');
        if (!fromCurrency || !toCurrency) {
          console.warn(`Invalid currency pair format: ${pair.pair}`);
          continue;
        }
        let newRate: number;
        
        if (fromCurrency === toCurrency) {
          newRate = 1;
        } else {
          try {
            if (forceRefresh) {
              // Force refresh: bypass cache and fetch directly from Yahoo Finance
              newRate = await this.fetchYahooFinanceRate(fromCurrency, toCurrency);
              // Update the cache with the fresh rate
              await this.cacheRate(fromCurrency, toCurrency, newRate);
            } else {
              // Use the getExchangeRate method which handles caching + fallbacks
              newRate = await this.getExchangeRate(fromCurrency, toCurrency);
            }
          } catch (error) {
            console.warn(`Failed to update rate for ${pair.pair}, keeping current rate:`, error);
            newRate = pair.currentRate; // Keep current rate if update fails
          }
        }

        // Update the pair
        await dbRun(
          'UPDATE currency_pairs SET current_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newRate, pair.id]
        );
      }

      console.log(`Updated ${pairs.length} currency pairs with Yahoo Finance data`);
      LastUpdateService.updateCurrencyTime();
    } catch (error) {
      console.error('Error updating currency pairs:', error);
      throw error;
    }
  }

  /**
   * Get cached exchange rate
   */
  private static async getCachedRate(fromCurrency: string, toCurrency: string): Promise<{ rate: number; timestamp: string } | null> {
    try {
      const result = await dbGet(
        'SELECT rate, updated_at FROM exchange_rates WHERE pair = ?',
        [`${fromCurrency}/${toCurrency}`]
      );
      
      return result ? { rate: result.rate, timestamp: result.updated_at } : null;
    } catch (error) {
      console.error('Error getting cached rate:', error);
      return null;
    }
  }

  /**
   * Cache exchange rate
   */
  private static async cacheRate(fromCurrency: string, toCurrency: string, rate: number): Promise<void> {
    try {
      await dbRun(
        'INSERT OR REPLACE INTO exchange_rates (pair, rate, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [`${fromCurrency}/${toCurrency}`, rate]
      );
    } catch (error) {
      console.error('Error caching rate:', error);
    }
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(timestamp: string): boolean {
    const cacheTime = new Date(timestamp).getTime();
    const now = Date.now();
    return (now - cacheTime) < this.CACHE_DURATION;
  }

  /**
   * Check if cache should be force updated (even if still valid)
   */
  private static shouldForceUpdate(timestamp: string): boolean {
    const cacheTime = new Date(timestamp).getTime();
    const now = Date.now();
    return (now - cacheTime) > this.FORCE_UPDATE_DURATION;
  }

  /**
   * Get last update time for display purposes
   */
  static async getLastUpdateTime(): Promise<string | null> {
    try {
      const result = await dbGet(
        'SELECT MAX(updated_at) as last_update FROM exchange_rates'
      );
      return result?.last_update || null;
    } catch (error) {
      console.error('Error getting last update time:', error);
      return null;
    }
  }

  /**
   * Get popular currency pairs for suggestions based on base currency
   */
  static getPopularPairs(baseCurrency: string = 'HKD'): string[] {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD'];
    const pairs: string[] = [];
    
    // Generate pairs with base currency as target
    currencies.forEach(currency => {
      if (currency !== baseCurrency) {
        pairs.push(`${currency}/${baseCurrency}`);
      }
    });
    
    // Add some reverse pairs for common currencies
    if (baseCurrency !== 'USD') {
      pairs.push(`${baseCurrency}/USD`);
    }
    if (baseCurrency !== 'EUR') {
      pairs.push(`${baseCurrency}/EUR`);
    }
    if (baseCurrency !== 'GBP') {
      pairs.push(`${baseCurrency}/GBP`);
    }
    
    return pairs;
  }

}
