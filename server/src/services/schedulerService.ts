import cron from 'node-cron';
import { PerformanceHistoryService } from './performanceHistoryService.js';
import { dbAll, dbRun } from '../database/connection.js';
import { ExchangeRateService } from './exchangeRateService.js';
import { OtherPortfolioService } from './otherPortfolioService.js';
import { LastUpdateService } from './lastUpdateService.js';
import { SchwabService } from './schwabService.js';
import { QQQService } from './qqqService.js';
import { Logger } from '../utils/logger.js';

export class SchedulerService {
  private static isRunning = false;
  private static dataRefreshTask: ReturnType<typeof cron.schedule> | null = null;
  private static schwabRefreshTask: ReturnType<typeof cron.schedule> | null = null;
  private static schwabTokenRefreshTask: ReturnType<typeof cron.schedule> | null = null;

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

    // Initialize QQQ data
    await QQQService.initialize();

    // Schedule daily performance calculation at 11:59 PM Dublin time
    // Dublin time is GMT+0 (standard time) or GMT+1 (daylight saving time)
    // Using '59 23 * * *' for 11:59 PM server time
    // Note: In production, you should set the server timezone to Europe/Dublin
    const dailyPerformanceTask = cron.schedule('59 23 * * *', async () => {
      // Run concurrent tasks
      await Promise.all([
        this.calculateDailySnapshots(),
        QQQService.updateHoldings()
      ]);
    }, {
      timezone: 'Europe/Dublin'
    });

    // Schedule automatic data refresh every 30 minutes
    // Sequence: Currency -> Manual Investments
    // Note: IB Portfolio is handled automatically by IBServiceOptimized with real-time updates
    this.dataRefreshTask = cron.schedule('*/30 * * * *', async () => {
      await this.refreshAllData();
    });

    // Schedule Schwab portfolio refresh every minute
    this.schwabRefreshTask = cron.schedule('* * * * *', async () => {
      await this.refreshSchwabPortfolios();
    });

    // Schedule proactive Schwab token refresh every 20 minutes to keep tokens alive
    this.schwabTokenRefreshTask = cron.schedule('*/20 * * * *', async () => {
      await this.proactiveSchwabTokenRefresh();
    });

    // Also schedule a test task that runs every minute (for development/testing)
    // Remove this in production
    if (process.env.NODE_ENV === 'development') {
      cron.schedule('* * * * *', () => {
        Logger.debug(`[${new Date().toISOString()}] Scheduler is running... Next daily calculation: 11:59 PM Dublin time, Next data refresh: every 30 minutes, Schwab refresh: every minute`);
      });
    }

    this.isRunning = true;
    Logger.info('✅ Scheduler service initialized');
    Logger.info('📅 Daily performance snapshots will be calculated at 11:59 PM Dublin time');
    Logger.info('🔄 Data refresh (Currency -> Manual Investments -> IB Close Prices) will run every 30 minutes');
    Logger.info('💼 Schwab portfolio refresh will run every minute');
    Logger.info('🔑 Schwab token refresh will run every 20 minutes to keep tokens alive');
    Logger.info('📊 IB Portfolio updates are handled automatically by IBServiceOptimized');
    Logger.info('📊 IB close prices will be refreshed from Yahoo Finance every 30 minutes (no cache)');

    // Calculate today's snapshot immediately if it doesn't exist (uses cached data only)
    this.calculateTodayIfMissing();

    // Check and refresh missing exchange rates in the background
    this.refreshMissingExchangeRates();

    // Refresh IB close prices on startup (in background)
    this.refreshIBClosePricesOnStartup();

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

    if (this.schwabRefreshTask) {
      this.schwabRefreshTask.stop();
      this.schwabRefreshTask = null;
    }

    if (this.schwabTokenRefreshTask) {
      this.schwabTokenRefreshTask.stop();
      this.schwabTokenRefreshTask = null;
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

      // Step 1: Copy current bond prices to close prices for IB portfolios
      // This is needed because IB doesn't provide close prices for bonds
      Logger.info('📋 Step 1: Copying IB bond prices to close prices...');
      try {
        const { IBServiceOptimized } = await import('./ibServiceOptimized.js');
        await IBServiceOptimized.copyBondPricesToClose();
        Logger.info('✅ IB bond prices copied to close prices');
      } catch (error) {
        Logger.error('❌ Failed to copy IB bond prices:', error);
      }

      // Step 2: Calculate snapshots for all users
      Logger.info('📊 Step 2: Calculating performance snapshots...');

      // Get all users
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;

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
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;

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
   * Refresh all data in sequence: Currency -> Manual Investments -> IB Close Prices
   */
  private static async refreshAllData() {
    try {
      Logger.info(`[${new Date().toISOString()}] 🔄 Starting automatic data refresh sequence...`);
      const refreshStartTime = Date.now();

      // Step 1: Refresh Currency Exchange Rates
      Logger.info('📈 Step 1/3: Refreshing currency exchange rates...');
      try {
        // Get all users to refresh their currency pairs
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;
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
      Logger.info('💼 Step 2/3: Refreshing manual investment market data...');
      try {
        await OtherPortfolioService.updateAllMarketData('default');

        // Recalculate today's performance snapshot after manual investment update
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;
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

      // Step 3: Refresh IB Close Prices from Yahoo Finance
      Logger.info('📊 Step 3/3: Refreshing IB close prices from Yahoo Finance...');
      try {
        const { IBServiceOptimized } = await import('./ibServiceOptimized.js');
        await IBServiceOptimized.refreshAllClosePrices();

        // Recalculate today's performance snapshot after IB close price update
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;
        for (const user of users) {
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            Logger.debug(`📈 Updated performance snapshot after IB close price refresh for user: ${user.name}`);
          } catch (performanceError) {
            Logger.error(`❌ Failed to update performance snapshot after IB close price refresh for user ${user.name}:`, performanceError);
          }
        }

        Logger.info('✅ IB close prices refreshed successfully');
      } catch (error) {
        Logger.error('❌ Failed to refresh IB close prices:', error);
      }

      const refreshEndTime = Date.now();
      const totalDuration = refreshEndTime - refreshStartTime;
      Logger.info(`[${new Date().toISOString()}] ✅ Automatic data refresh sequence completed in ${totalDuration}ms`);

    } catch (error) {
      Logger.error('❌ Error in automatic data refresh sequence:', error);
    }
  }

  /**
   * Refresh IB close prices on startup (in background)
   */
  private static async refreshIBClosePricesOnStartup() {
    try {
      Logger.info('🚀 Refreshing IB close prices on startup...');
      const { IBServiceOptimized } = await import('./ibServiceOptimized.js');
      await IBServiceOptimized.refreshAllClosePrices();
      Logger.info('✅ IB close prices refreshed on startup');
    } catch (error) {
      Logger.error('❌ Failed to refresh IB close prices on startup:', error);
    }
  }

  /**
   * Check and refresh missing exchange rates in the background
   */
  private static async refreshMissingExchangeRates() {
    try {
      Logger.debug('🔍 Checking for missing exchange rates...');

      // Get all users and their currency pairs
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{ id: number, email: string, name: string }>;

      let refreshCount = 0;
      for (const user of users) {
        try {
          // Get currency pairs for this user
          const pairs = await dbAll(
            'SELECT DISTINCT pair FROM currency_pairs WHERE user_id = ?',
            [user.id]
          ) as Array<{ pair: string }>;

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
   * Refresh all Schwab portfolios and update performance snapshots
   */
  private static async refreshSchwabPortfolios() {
    try {
      Logger.debug(`[${new Date().toISOString()}] 🔄 Starting Schwab portfolio refresh...`);
      const refreshStartTime = Date.now();

      // Refresh all Schwab accounts
      await SchwabService.refreshAllAccounts();

      // Get all users with Schwab accounts and update their performance snapshots
      const users = await dbAll(
        `SELECT DISTINCT u.id, u.email, u.name 
         FROM users u
         INNER JOIN accounts a ON u.id = a.user_id
         WHERE a.integration_type = 'SCHWAB'`
      ) as Array<{ id: number, email: string, name: string }>;

      for (const user of users) {
        try {
          await PerformanceHistoryService.calculateTodaySnapshot(user.id);
          Logger.debug(`📈 Updated performance snapshot after Schwab refresh for user: ${user.name}`);
        } catch (performanceError) {
          Logger.error(`❌ Failed to update performance snapshot after Schwab refresh for user ${user.name}:`, performanceError);
        }
      }

      const refreshEndTime = Date.now();
      const totalDuration = refreshEndTime - refreshStartTime;
      Logger.debug(`[${new Date().toISOString()}] ✅ Schwab portfolio refresh completed in ${totalDuration}ms`);

    } catch (error) {
      Logger.error('❌ Error in Schwab portfolio refresh:', error);
    }
  }

  /**
   * Manually trigger Schwab portfolio refresh (for testing)
   */
  static async triggerSchwabRefresh() {
    Logger.info('Manually triggering Schwab portfolio refresh...');
    await this.refreshSchwabPortfolios();
  }

  /**
   * Proactively refresh Schwab tokens to keep them alive
   */
  private static async proactiveSchwabTokenRefresh() {
    try {
      Logger.debug(`[${new Date().toISOString()}] 🔑 Starting proactive Schwab token refresh...`);
      await SchwabService.proactiveTokenRefresh();
    } catch (error) {
      Logger.error('❌ Error in proactive Schwab token refresh:', error);
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
      schwabRefreshInterval: '1 minute',
      lastDataRefresh: new Date().toISOString()
    };
  }
}
