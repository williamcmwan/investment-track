import { dbRun, dbGet, dbAll } from '../database/connection.js';

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
  private static readonly API_URL = 'https://api.exchangerate-api.com/v4/latest';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch exchange rates from external API
   */
  static async fetchLatestRates(): Promise<Record<string, number>> {
    try {
      console.log('Fetching latest exchange rates...');
      
      // Use a free API that doesn't require authentication
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.rates) {
        throw new Error('Invalid API response format');
      }
      
      console.log('Successfully fetched exchange rates');
      return data.rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  /**
   * Get exchange rate for a specific pair
   */
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // If same currency, return 1
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check cache first
      const cached = await this.getCachedRate(fromCurrency, toCurrency);
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.rate;
      }

      // Fetch latest rates
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
      console.error(`Error getting exchange rate for ${fromCurrency}/${toCurrency}:`, error);
      return 1; // Fallback to 1:1
    }
  }

  /**
   * Update all currency pairs with latest rates
   */
  static async updateAllCurrencyPairs(userId: number): Promise<void> {
    try {
      console.log(`Updating currency pairs for user ${userId}...`);
      
      // Get all currency pairs for the user
      const pairs = await dbAll(
        'SELECT id, pair FROM currency_pairs WHERE user_id = ?',
        [userId]
      ) as CurrencyPair[];

      if (pairs.length === 0) {
        console.log('No currency pairs to update');
        return;
      }

      // Fetch latest rates
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

      console.log(`Updated ${pairs.length} currency pairs`);
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
