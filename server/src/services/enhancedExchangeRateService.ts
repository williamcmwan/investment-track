import { dbRun, dbGet, dbAll } from '../database/connection.js';

interface ExchangeRate {
  pair: string;
  rate: number;
  timestamp: string;
  source: string;
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

export class EnhancedExchangeRateService {
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private static readonly FORCE_UPDATE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Multiple API sources for better accuracy
  private static readonly API_SOURCES = [
    {
      name: 'exchangerate-api',
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      weight: 0.4 // 40% weight
    },
    {
      name: 'currencyapi',
      url: 'https://api.currencyapi.com/v3/latest?apikey=YOUR_API_KEY&base=USD',
      weight: 0.3 // 30% weight (requires API key)
    },
    {
      name: 'fixer',
      url: 'http://data.fixer.io/api/latest?access_key=YOUR_API_KEY&base=USD',
      weight: 0.3 // 30% weight (requires API key)
    }
  ];

  /**
   * Fetch exchange rates from multiple sources and calculate weighted average
   */
  static async fetchLatestRates(): Promise<Record<string, number>> {
    try {
      console.log('Fetching latest exchange rates from multiple sources...');
      
      const rates: Record<string, number> = {};
      const sourceResults: Array<{ source: string; rates: Record<string, number>; weight: number }> = [];

      // Try to fetch from exchangerate-api (free, no key required)
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            sourceResults.push({
              source: 'exchangerate-api',
              rates: data.rates,
              weight: 0.6 // Higher weight for free source
            });
            console.log('✅ exchangerate-api: Success');
          }
        }
      } catch (error) {
        console.log('❌ exchangerate-api: Failed', error);
      }

      // Try to fetch from a backup free source
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            // Convert EUR-based rates to USD-based
            const eurToUsd = 1 / data.rates.USD;
            const convertedRates: Record<string, number> = {};
            Object.keys(data.rates).forEach(currency => {
              if (currency !== 'EUR') {
                convertedRates[currency] = data.rates[currency] * eurToUsd;
              }
            });
            convertedRates.USD = 1;
            
            sourceResults.push({
              source: 'exchangerate-api-eur',
              rates: convertedRates,
              weight: 0.4 // Lower weight for converted rates
            });
            console.log('✅ exchangerate-api-eur: Success');
          }
        }
      } catch (error) {
        console.log('❌ exchangerate-api-eur: Failed', error);
      }

      if (sourceResults.length === 0) {
        throw new Error('All API sources failed');
      }

      // Calculate weighted average rates
      const currencies = new Set<string>();
      sourceResults.forEach(result => {
        Object.keys(result.rates).forEach(currency => currencies.add(currency));
      });

      currencies.forEach(currency => {
        let weightedSum = 0;
        let totalWeight = 0;

        sourceResults.forEach(result => {
          if (result.rates[currency]) {
            weightedSum += result.rates[currency] * result.weight;
            totalWeight += result.weight;
          }
        });

        if (totalWeight > 0) {
          rates[currency] = weightedSum / totalWeight;
        }
      });

      console.log(`✅ Successfully fetched rates from ${sourceResults.length} sources`);
      console.log(`📊 Calculated weighted average for ${Object.keys(rates).length} currencies`);
      
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates from multiple sources:', error);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  /**
   * Get exchange rate for a specific pair with enhanced accuracy
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // If same currency, return 1
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check cache first
      const cached = await this.getCachedRate(fromCurrency, toCurrency);
      if (cached && this.isCacheValid(cached.timestamp) && !this.shouldForceUpdate(cached.timestamp)) {
        return cached.rate;
      }

      // Fetch latest rates from multiple sources
      const rates = await this.fetchLatestRates();
      
      // Convert to requested pair
      let rate: number;
      if (fromCurrency === 'USD') {
        rate = rates[toCurrency] || 1;
      } else if (toCurrency === 'USD') {
        rate = 1 / (rates[fromCurrency] || 1);
      } else {
        // Convert through USD
        const fromToUSD = 1 / (rates[fromCurrency] || 1);
        const usdToTarget = rates[toCurrency] || 1;
        rate = fromToUSD * usdToTarget;
      }

      // Cache the result
      await this.cacheRate(fromCurrency, toCurrency, rate);
      
      return rate;
    } catch (error) {
      console.error(`Error getting enhanced exchange rate for ${fromCurrency}/${toCurrency}:`, error);
      return 1; // Fallback to 1:1
    }
  }

  /**
   * Update all currency pairs with latest rates from multiple sources
   */
  static async updateAllCurrencyPairs(userId: number): Promise<void> {
    try {
      console.log(`Updating currency pairs for user ${userId} with enhanced accuracy...`);
      
      // Get all currency pairs for the user
      const pairs = await dbAll(
        'SELECT id, pair FROM currency_pairs WHERE user_id = ?',
        [userId]
      ) as CurrencyPair[];

      if (pairs.length === 0) {
        console.log('No currency pairs to update');
        return;
      }

      // Fetch latest rates from multiple sources
      const rates = await this.fetchLatestRates();
      
      // Update each pair
      for (const pair of pairs) {
        const [fromCurrency, toCurrency] = pair.pair.split('/');
        let newRate: number;
        
        if (fromCurrency === toCurrency) {
          newRate = 1;
        } else if (fromCurrency === 'USD') {
          newRate = rates[toCurrency] || pair.currentRate;
        } else if (toCurrency === 'USD') {
          newRate = 1 / (rates[fromCurrency] || 1);
        } else {
          // Convert through USD
          const fromToUSD = 1 / (rates[fromCurrency] || 1);
          const usdToTarget = rates[toCurrency] || 1;
          newRate = fromToUSD * usdToTarget;
        }

        // Update the pair
        await dbRun(
          'UPDATE currency_pairs SET current_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newRate, pair.id]
        );
      }

      console.log(`✅ Updated ${pairs.length} currency pairs with enhanced accuracy`);
    } catch (error) {
      console.error('Error updating currency pairs with enhanced rates:', error);
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
   * Check if cache should be force updated
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
