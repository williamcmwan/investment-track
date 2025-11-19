import cron from 'node-cron';
import { PerformanceHistoryService } from './performanceHistoryService.js';
import { dbAll, dbRun } from '../database/connection.js';
import { ExchangeRateService } from './exchangeRateService.js';
import { OtherPortfolioService } from './otherPortfolioService.js';
import { LastUpdateService } from './lastUpdateService.js';
import { Logger } from '../utils/logger.js';

export class SchedulerService {
  private static isRunning = false;
  private static dataRefreshTask: ReturnType<typeof cron.schedule> | null = null;

  /**
   * Initialize the scheduler service
   */
  static async initialize() {
    if (this.isRunning) {
      Logger.info('Scheduler service is already running');
      return;
    }

    Logger.info('🚀 Initializing scheduler service...');
    
    // Initialize last update service
    await LastUpdateService.initialize();
    
    // Schedule daily performance calculation at 11:59 PM Dublin time
    // Dublin time is GMT+0 (standard time) or GMT+1 (daylight saving time)
    // Using '59 23 * * *' for 11:59 PM server time
    // Note: In production, you should set the server timezone to Europe/Dublin
    const dailyPerformanceTask = cron.schedule('59 23 * * *', async () => {
      await this.calculateDailySnapshots();
    }, {
      timezone: 'Europe/Dublin'
    });

    // Schedule automatic data refresh every 30 minutes
    // Sequence: Currency -> Manual Investments
    // Note: IB Portfolio is handled automatically by IBServiceOptimized with real-time updates
    this.dataRefreshTask = cron.schedule('*/30 * * * *', async () => {
      await this.refreshAllData();
    });

    // Update IB close prices from Yahoo Finance every hour
    cron.schedule('0 * * * *', async () => {
      await this.updateIBClosePrices();
    });

    // Also schedule a test task that runs every minute (for development/testing)
    // Remove this in production
    if (process.env.NODE_ENV === 'development') {
      cron.schedule('* * * * *', () => {
        Logger.debug(`[${new Date().toISOString()}] Scheduler is running... Next daily calculation: 11:59 PM Dublin time, Next data refresh: every 30 minutes`);
      });
    }

    this.isRunning = true;
    Logger.info('✅ Scheduler service initialized');
    Logger.info('📅 Daily performance snapshots will be calculated at 11:59 PM Dublin time');
    Logger.info('🔄 Data refresh (Currency -> Manual Investments) will run every 30 minutes');
    Logger.info('📊 IB close prices will be updated from Yahoo Finance every hour');
    Logger.info('📊 IB Portfolio updates are handled automatically by IBServiceOptimized');
    
    // Calculate today's snapshot immediately if it doesn't exist (uses cached data only)
    this.calculateTodayIfMissing();
    
    // Check and refresh missing exchange rates in the background
    this.refreshMissingExchangeRates();
    
    // Update IB close prices from Yahoo Finance on startup (in background)
    this.updateIBClosePricesOnStartup();
    
    // Don't run initial data refresh on startup - let scheduled job handle it
    Logger.info('📅 Initial data refresh skipped - will run on first scheduled interval');
  }

  /**
   * Stop the scheduler service
   */
  static stop() {
    if (!this.isRunning) {
      Logger.info('Scheduler service is not running');
      return;
    }

    cron.getTasks().forEach(task => {
      task.stop();
    });

    if (this.dataRefreshTask) {
      this.dataRefreshTask.stop();
      this.dataRefreshTask = null;
    }

    this.isRunning = false;
    Logger.info('🛑 Scheduler service stopped');
  }

  /**
   * Calculate daily snapshots for all users
   */
  private static async calculateDailySnapshots() {
    try {
      Logger.info(`[${new Date().toISOString()}] Starting daily performance snapshot calculation...`);
      
      // Get all users
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
      
      if (users.length === 0) {
        Logger.info('No users found for daily snapshot calculation');
        return;
      }

      Logger.info(`Found ${users.length} users, calculating snapshots...`);

      let successCount = 0;
      let errorCount = 0;

      // Calculate snapshot for each user
      for (const user of users) {
        try {
          await PerformanceHistoryService.calculateTodaySnapshot(user.id);
          Logger.debug(`✅ Calculated snapshot for user: ${user.name} (${user.email})`);
          successCount++;
        } catch (error) {
          Logger.error(`❌ Failed to calculate snapshot for user: ${user.name} (${user.email})`, error);
          errorCount++;
        }
      }

      Logger.info(`[${new Date().toISOString()}] Daily snapshot calculation completed:`);
      Logger.info(`  ✅ Successful: ${successCount} users`);
      Logger.info(`  ❌ Failed: ${errorCount} users`);
      
    } catch (error) {
      Logger.error('Error in daily snapshot calculation:', error);
    }
  }

  /**
   * Calculate today's snapshot if it doesn't exist (run on startup)
   */
  private static async calculateTodayIfMissing() {
    try {
      Logger.debug('Checking if today\'s snapshot needs to be calculated...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get all users
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
      
      for (const user of users) {
        // Check if today's snapshot already exists
        const existingSnapshot = await dbAll(
          'SELECT id FROM performance_history WHERE user_id = ? AND date = ?',
          [user.id, today]
        );

        if (existingSnapshot.length === 0) {
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            Logger.debug(`✅ Calculated missing snapshot for user: ${user.name} (${user.email})`);
          } catch (error) {
            Logger.error(`❌ Failed to calculate missing snapshot for user: ${user.name} (${user.email})`, error);
          }
        } else {
          Logger.debug(`📊 Snapshot already exists for user: ${user.name} (${user.email})`);
        }
      }
      
    } catch (error) {
      Logger.error('Error checking/calculating missing snapshots:', error);
    }
  }

  /**
   * Manually trigger daily snapshot calculation (for testing)
   */
  static async triggerDailyCalculation() {
    Logger.info('Manually triggering daily snapshot calculation...');
    await this.calculateDailySnapshots();
  }

  /**
   * Manually trigger data refresh (for testing or manual refresh)
   */
  static async triggerDataRefresh() {
    Logger.info('Manually triggering data refresh...');
    await this.refreshAllData();
  }

  /**
   * Refresh all data in sequence: Currency -> Manual Investments
   * Note: IB Portfolio is handled automatically by IBServiceOptimized
   */
  private static async refreshAllData() {
    try {
      Logger.info(`[${new Date().toISOString()}] 🔄 Starting automatic data refresh sequence...`);
      const refreshStartTime = Date.now();
      
      // Step 1: Refresh Currency Exchange Rates
      Logger.info('📈 Step 1/2: Refreshing currency exchange rates...');
      try {
        // Get all users to refresh their currency pairs
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
        for (const user of users) {
          await ExchangeRateService.updateAllCurrencyPairs(user.id);
          
          // Recalculate today's performance snapshot after currency update
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            Logger.debug(`📈 Updated performance snapshot after currency refresh for user: ${user.name}`);
          } catch (performanceError) {
            Logger.error(`❌ Failed to update performance snapshot after currency refresh for user ${user.name}:`, performanceError);
          }
        }
        await LastUpdateService.updateCurrencyTime();
        Logger.info('✅ Currency exchange rates refreshed successfully');
      } catch (error) {
        Logger.error('❌ Failed to refresh currency exchange rates:', error);
      }

      // Step 2: Refresh Manual Investment Market Data
      // Note: IB Portfolio is handled automatically by IBServiceOptimized with real-time updates
      Logger.info('💼 Step 2/2: Refreshing manual investment market data...');
      try {
        await OtherPortfolioService.updateAllMarketData('default');
        
        // Recalculate today's performance snapshot after manual investment update
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
        for (const user of users) {
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            Logger.debug(`📈 Updated performance snapshot after manual investment refresh for user: ${user.name}`);
          } catch (performanceError) {
            Logger.error(`❌ Failed to update performance snapshot after manual investment refresh for user ${user.name}:`, performanceError);
          }
        }
        
        // Note: Manual investment update times are now tracked per-account in OtherPortfolioService
        Logger.info('✅ Manual investment market data refreshed successfully');
      } catch (error) {
        Logger.error('❌ Failed to refresh manual investment market data:', error);
      }

      const refreshEndTime = Date.now();
      const totalDuration = refreshEndTime - refreshStartTime;
      Logger.info(`[${new Date().toISOString()}] ✅ Automatic data refresh sequence completed in ${totalDuration}ms`);
      
    } catch (error) {
      Logger.error('❌ Error in automatic data refresh sequence:', error);
    }
  }

  /**
   * Check and refresh missing exchange rates in the background
   */
  private static async refreshMissingExchangeRates() {
    try {
      Logger.debug('🔍 Checking for missing exchange rates...');
      
      // Get all users and their currency pairs
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
      
      let refreshCount = 0;
      for (const user of users) {
        try {
          // Get currency pairs for this user
          const pairs = await dbAll(
            'SELECT DISTINCT pair FROM currency_pairs WHERE user_id = ?',
            [user.id]
          ) as Array<{pair: string}>;
          
          for (const pairRow of pairs) {
            const [fromCurrency, toCurrency] = pairRow.pair.split('/');
            if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
              continue;
            }
            
            // Check if exchange rate exists in cache
            const cached = await dbAll(
              'SELECT rate, updated_at FROM exchange_rates WHERE pair = ?',
              [pairRow.pair]
            );
            
            if (cached.length === 0) {
              Logger.debug(`📈 Missing exchange rate for ${pairRow.pair}, fetching from Yahoo Finance...`);
              try {
                // Fetch and cache the rate
                const rate = await ExchangeRateService.fetchYahooFinanceRate(fromCurrency, toCurrency);
                await dbRun(
                  'INSERT OR REPLACE INTO exchange_rates (pair, rate, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                  [pairRow.pair, rate]
                );
                Logger.debug(`✅ Cached ${pairRow.pair}: ${rate}`);
                refreshCount++;
              } catch (error) {
                Logger.warn(`❌ Failed to fetch ${pairRow.pair}:`, error);
              }
            }
          }
        } catch (userError) {
          Logger.error(`❌ Failed to check exchange rates for user ${user.name}:`, userError);
        }
      }
      
      if (refreshCount > 0) {
        Logger.debug(`✅ Refreshed ${refreshCount} missing exchange rates`);
      } else {
        Logger.debug('✅ All required exchange rates are already cached');
      }
      
    } catch (error) {
      Logger.error('❌ Error checking missing exchange rates:', error);
    }
  }

  /**
   * Update IB close prices from Yahoo Finance on startup (non-blocking)
   */
  private static updateIBClosePricesOnStartup() {
    // Run in background after a short delay to not block startup
    setTimeout(async () => {
      Logger.info('🔄 Starting initial IB close price update from Yahoo Finance...');
      await this.updateIBClosePrices();
    }, 3000); // Start after 3 seconds
  }

  /**
   * Update IB close prices from Yahoo Finance
   */
  private static async updateIBClosePrices() {
    try {
      Logger.debug('Updating IB close prices from Yahoo Finance...');
      
      const { YahooFinanceService } = await import('./yahooFinanceService.js');
      
      // Get all IB positions with exchange info
      const positions = await dbAll(
        `SELECT DISTINCT symbol, con_id, exchange, primary_exchange 
         FROM portfolios 
         WHERE source = 'IB' 
         AND sec_type NOT IN ('BOND', 'CRYPTO')
         AND symbol IS NOT NULL`,
        []
      );
      
      if (positions.length === 0) {
        Logger.debug('No IB stock positions to update');
        return;
      }
      
      // Convert symbols to Yahoo Finance format
      const symbolMap = new Map<string, any>();
      const yahooSymbols: string[] = [];
      
      for (const position of positions) {
        const yahooSymbol = this.convertToYahooSymbol(
          position.symbol, 
          position.exchange || position.primary_exchange
        );
        yahooSymbols.push(yahooSymbol);
        symbolMap.set(yahooSymbol, position);
      }
      
      Logger.debug(`Fetching close prices for ${yahooSymbols.length} symbols from Yahoo Finance...`);
      
      const marketDataResults = await YahooFinanceService.getMultipleMarketData(yahooSymbols);
      
      // Update database
      let updatedCount = 0;
      for (const [yahooSymbol, marketData] of marketDataResults.entries()) {
        const position = symbolMap.get(yahooSymbol);
        if (position && marketData.closePrice > 0) {
          await dbRun(
            `UPDATE portfolios 
             SET close_price = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE con_id = ? AND source = 'IB'`,
            [marketData.closePrice, position.con_id]
          );
          updatedCount++;
        }
      }
      
      Logger.info(`✅ Updated ${updatedCount}/${yahooSymbols.length} IB close prices from Yahoo Finance`);
    } catch (error) {
      Logger.error('❌ Error updating IB close prices:', error);
    }
  }

  /**
   * Convert IB symbol to Yahoo Finance symbol format
   * Adds exchange suffixes for non-US stocks
   */
  private static convertToYahooSymbol(symbol: string, exchange?: string): string {
    if (!exchange) {
      return symbol;
    }

    const exchangeUpper = exchange.toUpperCase();
    
    // Singapore stocks need .SI suffix
    if (exchangeUpper === 'SGX' || exchangeUpper === 'SGXCENT') {
      return `${symbol}.SI`;
    }
    
    // Hong Kong stocks need .HK suffix
    if (exchangeUpper === 'SEHK' || exchangeUpper === 'HKFE') {
      return `${symbol}.HK`;
    }
    
    // London stocks need .L suffix
    if (exchangeUpper === 'LSE') {
      return `${symbol}.L`;
    }
    
    // Australian stocks need .AX suffix
    if (exchangeUpper === 'ASX') {
      return `${symbol}.AX`;
    }
    
    // German stocks need .DE suffix (Frankfurt)
    if (exchangeUpper === 'FWB' || exchangeUpper === 'IBIS') {
      return `${symbol}.DE`;
    }
    
    // US and Canadian stocks don't need suffix
    return symbol;
  }

  /**
   * Get scheduler status
   */
  static getStatus() {
    const tasks = cron.getTasks();
    return {
      isRunning: this.isRunning,
      tasks: Object.keys(tasks).length,
      nextRun: '11:59 PM Dublin time daily',
      dataRefreshInterval: '30 minutes',
      lastDataRefresh: new Date().toISOString()
    };
  }
}
