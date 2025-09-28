import cron from 'node-cron';
import { PerformanceHistoryService } from './performanceHistoryService.js';
import { dbAll } from '../database/connection.js';

export class SchedulerService {
  private static isRunning = false;

  /**
   * Initialize the scheduler service
   */
  static initialize() {
    if (this.isRunning) {
      console.log('Scheduler service is already running');
      return;
    }

    console.log('🚀 Initializing scheduler service...');
    
    // Schedule daily performance calculation at 11:59 PM Dublin time
    // Dublin time is GMT+0 (standard time) or GMT+1 (daylight saving time)
    // Using '59 23 * * *' for 11:59 PM server time
    // Note: In production, you should set the server timezone to Europe/Dublin
    const dailyPerformanceTask = cron.schedule('59 23 * * *', async () => {
      await this.calculateDailySnapshots();
    }, {
      timezone: 'Europe/Dublin'
    });

    // Also schedule a test task that runs every minute (for development/testing)
    // Remove this in production
    if (process.env.NODE_ENV === 'development') {
      cron.schedule('* * * * *', () => {
        console.log(`[${new Date().toISOString()}] Scheduler is running... Next daily calculation: 11:59 PM Dublin time`);
      });
    }

    this.isRunning = true;
    console.log('✅ Scheduler service initialized');
    console.log('📅 Daily performance snapshots will be calculated at 11:59 PM Dublin time');
    
    // Calculate today's snapshot immediately if it doesn't exist
    this.calculateTodayIfMissing();
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
   * Get scheduler status
   */
  static getStatus() {
    const tasks = cron.getTasks();
    return {
      isRunning: this.isRunning,
      tasks: Object.keys(tasks).length,
      nextRun: '11:59 PM Dublin time daily'
    };
  }
}
