import cron from 'node-cron';
import { PerformanceHistoryService } from './performanceHistoryService.js';
import { dbAll } from '../database/connection.js';
import { ExchangeRateService } from './exchangeRateService.js';
import { OtherPortfolioService } from './otherPortfolioService.js';
import { IBService } from './ibService.js';
import { LastUpdateService } from './lastUpdateService.js';
import { IBConnectionService } from './ibConnectionService.js';

export class SchedulerService {
  private static isRunning = false;
  private static dataRefreshTask: ReturnType<typeof cron.schedule> | null = null;

  /**
   * Initialize the scheduler service
   */
  static initialize() {
    if (this.isRunning) {
      console.log('Scheduler service is already running');
      return;
    }

    console.log('🚀 Initializing scheduler service...');
    
    // Initialize last update service
    LastUpdateService.initialize();
    
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
        console.log(`[${new Date().toISOString()}] Scheduler is running... Next daily calculation: 11:59 PM Dublin time, Next data refresh: every 30 minutes`);
      });
    }

    this.isRunning = true;
    console.log('✅ Scheduler service initialized');
    console.log('📅 Daily performance snapshots will be calculated at 11:59 PM Dublin time');
    console.log('🔄 Data refresh (Currency -> IB -> Manual) will run every 30 minutes');
    
    // Calculate today's snapshot immediately if it doesn't exist
    this.calculateTodayIfMissing();
    
    // Run initial data refresh
    this.refreshAllData();
  }

  /**
   * Stop the scheduler service
   */
  static stop() {
    if (!this.isRunning) {
      console.log('Scheduler service is not running');
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
    console.log('🛑 Scheduler service stopped');
  }

  /**
   * Calculate daily snapshots for all users
   */
  private static async calculateDailySnapshots() {
    try {
      console.log(`[${new Date().toISOString()}] Starting daily performance snapshot calculation...`);
      
      // Get all users
      const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
      
      if (users.length === 0) {
        console.log('No users found for daily snapshot calculation');
        return;
      }

      console.log(`Found ${users.length} users, calculating snapshots...`);

      let successCount = 0;
      let errorCount = 0;

      // Calculate snapshot for each user
      for (const user of users) {
        try {
          await PerformanceHistoryService.calculateTodaySnapshot(user.id);
          console.log(`✅ Calculated snapshot for user: ${user.name} (${user.email})`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to calculate snapshot for user: ${user.name} (${user.email})`, error);
          errorCount++;
        }
      }

      console.log(`[${new Date().toISOString()}] Daily snapshot calculation completed:`);
      console.log(`  ✅ Successful: ${successCount} users`);
      console.log(`  ❌ Failed: ${errorCount} users`);
      
    } catch (error) {
      console.error('Error in daily snapshot calculation:', error);
    }
  }

  /**
   * Calculate today's snapshot if it doesn't exist (run on startup)
   */
  private static async calculateTodayIfMissing() {
    try {
      console.log('Checking if today\'s snapshot needs to be calculated...');
      
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
            console.log(`✅ Calculated missing snapshot for user: ${user.name} (${user.email})`);
          } catch (error) {
            console.error(`❌ Failed to calculate missing snapshot for user: ${user.name} (${user.email})`, error);
          }
        } else {
          console.log(`📊 Snapshot already exists for user: ${user.name} (${user.email})`);
        }
      }
      
    } catch (error) {
      console.error('Error checking/calculating missing snapshots:', error);
    }
  }

  /**
   * Manually trigger daily snapshot calculation (for testing)
   */
  static async triggerDailyCalculation() {
    console.log('Manually triggering daily snapshot calculation...');
    await this.calculateDailySnapshots();
  }

  /**
   * Manually trigger data refresh (for testing or manual refresh)
   */
  static async triggerDataRefresh() {
    console.log('Manually triggering data refresh...');
    await this.refreshAllData();
  }

  /**
   * Refresh all data in sequence: Currency -> IB Portfolio -> Manual Investments
   */
  private static async refreshAllData() {
    try {
      console.log(`[${new Date().toISOString()}] 🔄 Starting automatic data refresh sequence...`);
      const refreshStartTime = Date.now();
      
      // Step 1: Refresh Currency Exchange Rates
      console.log('📈 Step 1/3: Refreshing currency exchange rates...');
      try {
        // Get all users to refresh their currency pairs
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
        for (const user of users) {
          await ExchangeRateService.updateAllCurrencyPairs(user.id);
          
          // Recalculate today's performance snapshot after currency update
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            console.log(`📈 Updated performance snapshot after currency refresh for user: ${user.name}`);
          } catch (performanceError) {
            console.error(`❌ Failed to update performance snapshot after currency refresh for user ${user.name}:`, performanceError);
          }
        }
        LastUpdateService.updateCurrencyTime();
        console.log('✅ Currency exchange rates refreshed successfully');
      } catch (error) {
        console.error('❌ Failed to refresh currency exchange rates:', error);
      }

      // Step 2: Refresh IB Portfolio Data
      console.log('📊 Step 2/3: Refreshing IB portfolio data...');
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
              console.log(`🔄 Refreshing IB data for user: ${user.name} (${user.email})`);
              
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
                  
                  console.log(`💰 Updated account balance: ${accountBalance.balance} ${accountBalance.currency}`);
                } catch (accountError) {
                  console.error(`❌ Failed to update account balance for user ${user.name}:`, accountError);
                }
              }
              
              // Recalculate today's performance snapshot after IB data update
              try {
                await PerformanceHistoryService.calculateTodaySnapshot(user.id);
                console.log(`📈 Updated performance snapshot for user: ${user.name}`);
              } catch (performanceError) {
                console.error(`❌ Failed to update performance snapshot for user ${user.name}:`, performanceError);
              }
              
              ibRefreshCount++;
              console.log(`✅ IB data refreshed for user: ${user.name}`);
            } else {
              ibSkippedCount++;
              console.log(`⏭️ Skipping IB refresh for ${user.name} (no IB settings configured)`);
            }
          } catch (userError) {
            console.error(`❌ Failed to refresh IB data for user ${user.name}:`, userError);
            ibSkippedCount++;
          }
        }
        
        if (ibRefreshCount > 0) {
          LastUpdateService.updateIBPortfolioTime();
          console.log(`✅ IB portfolio data refreshed for ${ibRefreshCount} users, ${ibSkippedCount} skipped`);
        } else {
          console.log(`⚠️ No users have IB settings configured - IB refresh skipped for all ${ibSkippedCount} users`);
        }
      } catch (error) {
        console.error('❌ Failed to refresh IB portfolio data:', error);
      }

      // Step 3: Refresh Manual Investment Market Data
      console.log('💼 Step 3/3: Refreshing manual investment market data...');
      try {
        await OtherPortfolioService.updateAllMarketData('default');
        
        // Recalculate today's performance snapshot after manual investment update
        const users = await dbAll('SELECT id, email, name FROM users') as Array<{id: number, email: string, name: string}>;
        for (const user of users) {
          try {
            await PerformanceHistoryService.calculateTodaySnapshot(user.id);
            console.log(`📈 Updated performance snapshot after manual investment refresh for user: ${user.name}`);
          } catch (performanceError) {
            console.error(`❌ Failed to update performance snapshot after manual investment refresh for user ${user.name}:`, performanceError);
          }
        }
        
        LastUpdateService.updateManualInvestmentsTime();
        console.log('✅ Manual investment market data refreshed successfully');
      } catch (error) {
        console.error('❌ Failed to refresh manual investment market data:', error);
      }

      const refreshEndTime = Date.now();
      const totalDuration = refreshEndTime - refreshStartTime;
      console.log(`[${new Date().toISOString()}] ✅ Automatic data refresh sequence completed in ${totalDuration}ms`);
      
    } catch (error) {
      console.error('❌ Error in automatic data refresh sequence:', error);
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
