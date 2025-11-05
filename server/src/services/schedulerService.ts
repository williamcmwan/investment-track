import cron from 'node-cron';
import { PerformanceHistoryService } from './performanceHistoryService.js';
import { dbAll, dbRun } from '../database/connection.js';
import { ExchangeRateService } from './exchangeRateService.js';
import { OtherPortfolioService } from './otherPortfolioService.js';
import { IBService } from './ibService.js';
import { LastUpdateService } from './lastUpdateService.js';
import { IBConnectionService } from './ibConnectionService.js';
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
    // Sequence: Currency -> IB Portfolio -> Other Portfolio (Manual Investments)
    this.dataRefreshTask = cron.schedule('*/30 * * * *', async () => {
      await this.refreshAllData();
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
    Logger.info('🔄 Data refresh (Currency -> IB -> Manual) will run every 30 minutes');
    
    // Calculate today's snapshot immediately if it doesn't exist (uses cached data only)
    this.calculateTodayIfMissing();
    
    // Check and refresh missing exchange rates in the background
    this.refreshMissingExchangeRates();
    
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
   * Refresh all data in sequence: Currency -> IB Portfolio -> Manual Investments
   */
  private static async refreshAllData() {
    try {
      Logger.info(`[${new Date().toISOString()}] 🔄 Starting automatic data refresh sequence...`);
      const refreshStartTime = Date.now();
      
      // Step 1: Refresh Currency Exchange Rates
      Logger.info('📈 Step 1/3: Refreshing currency exchange rates...');
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

      // Step 2: Refresh IB Portfolio Data
      Logger.info('📊 Step 2/3: Refreshing IB portfolio data...');
      try {
        // Get all users and check if they have IB settings configured
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
        let ibRefreshCount = 0;
        let ibSkippedCount = 0;
        
        for (const user of users) {
          try {
            // Check if user has IB settings configured
            const userIBSettings = await IBConnectionService.getUserIBSettings(user.id);
            
            if (userIBSettings) {
              Logger.debug(`🔄 Refreshing IB data for user: ${user.name} (${user.email})`);
              
              // Refresh both balance and portfolio for this user
              const accountBalance = await IBService.forceRefreshAccountBalance(userIBSettings);
              await IBService.forceRefreshPortfolio(userIBSettings);
              
              // Update the main account balance and balance history
              if (userIBSettings.target_account_id && accountBalance) {
                try {
                  const { AccountModel } = await import('../models/Account.js');
                  
                  // Update the account's current balance
                  await AccountModel.update(userIBSettings.target_account_id, user.id, {
                    currentBalance: accountBalance.balance
                  });
                  
                  // Add balance history entry for the scheduled update
                  await AccountModel.addBalanceHistory(
                    userIBSettings.target_account_id, 
                    accountBalance.balance, 
                    'Scheduled IB data refresh'
                  );
                  
                  Logger.debug(`💰 Updated account balance: ${accountBalance.balance} ${accountBalance.currency}`);
                } catch (accountError) {
                  Logger.error(`❌ Failed to update account balance for user ${user.name}:`, accountError);
                }
              }
              
              // Recalculate today's performance snapshot after IB data update
              try {
                await PerformanceHistoryService.calculateTodaySnapshot(user.id);
                Logger.debug(`📈 Updated performance snapshot for user: ${user.name}`);
              } catch (performanceError) {
                Logger.error(`❌ Failed to update performance snapshot for user ${user.name}:`, performanceError);
              }
              
              ibRefreshCount++;
              Logger.debug(`✅ IB data refreshed for user: ${user.name}`);
            } else {
              ibSkippedCount++;
              Logger.debug(`⏭️ Skipping IB refresh for ${user.name} (no IB settings configured)`);
            }
          } catch (userError) {
            Logger.error(`❌ Failed to refresh IB data for user ${user.name}:`, userError);
            ibSkippedCount++;
          }
        }
        
        if (ibRefreshCount > 0) {
          // Note: IB portfolio update times are now tracked per-account in IBService.forceRefreshPortfolio()
          Logger.info(`✅ IB portfolio data refreshed for ${ibRefreshCount} users, ${ibSkippedCount} skipped`);
        } else {
          Logger.info(`⚠️ No users have IB settings configured - IB refresh skipped for all ${ibSkippedCount} users`);
        }
      } catch (error) {
        Logger.error('❌ Failed to refresh IB portfolio data:', error);
      }

      // Step 3: Refresh Manual Investment Market Data
      Logger.info('💼 Step 3/3: Refreshing manual investment market data...');
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
