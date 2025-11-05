import { Logger } from '../utils/logger.js';

export class LastUpdateService {
  /**
   * Initialize the service - migrate existing file data to database if needed
   */
  static async initialize(): Promise<void> {
    await this.migrateFromFileToDatabase();
  }

  /**
   * Migrate existing file data to database (one-time migration)
   */
  private static async migrateFromFileToDatabase(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { dbRun, dbGet } = await import('../database/connection.js');
      
      const CACHE_DIR = path.join(process.cwd(), 'cache');
      const LAST_UPDATE_FILE = path.join(CACHE_DIR, 'last_updates.json');
      
      // Check if file exists and database doesn't have the data yet
      if (fs.existsSync(LAST_UPDATE_FILE)) {
        const data = fs.readFileSync(LAST_UPDATE_FILE, 'utf8');
        const fileData = JSON.parse(data);
        
        // Check if we already migrated
        const existingCurrency = await dbGet(
          'SELECT id FROM last_updates WHERE main_account_id IS NULL AND update_type = ?',
          ['EXCHANGE_RATES']
        );
        
        if (!existingCurrency && fileData.currency) {
          await dbRun(`
            INSERT INTO last_updates (main_account_id, update_type, last_updated, created_at, updated_at)
            VALUES (NULL, 'EXCHANGE_RATES', datetime(?, 'unixepoch', 'subsec'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [fileData.currency / 1000]);
          Logger.info('📅 Migrated currency update time to database');
        }
        
        // Note: IB and manual investment times are now account-specific, so we don't migrate them
        Logger.info('📅 Migration from file to database completed');
      }
    } catch (error) {
      Logger.error('❌ Failed to migrate from file to database:', error);
    }
  }

  /**
   * Update currency last refresh time (global, not account-specific)
   */
  static async updateCurrencyTime(): Promise<void> {
    try {
      const { dbRun } = await import('../database/connection.js');
      await dbRun(`
        INSERT OR REPLACE INTO last_updates (main_account_id, update_type, last_updated, updated_at)
        VALUES (NULL, 'EXCHANGE_RATES', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      Logger.debug('📅 Updated currency last refresh time in database');
    } catch (error) {
      Logger.error('❌ Failed to update currency time:', error);
    }
  }

  /**
   * Update IB portfolio last refresh time for specific account
   */
  static async updateIBPortfolioTime(mainAccountId?: number): Promise<void> {
    if (!mainAccountId) {
      Logger.warn('⚠️ No account ID provided for IB portfolio update - skipping');
      return;
    }
    
    try {
      const { dbRun } = await import('../database/connection.js');
      await dbRun(`
        INSERT OR REPLACE INTO last_updates (main_account_id, update_type, last_updated, updated_at)
        VALUES (?, 'IB_PORTFOLIO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [mainAccountId]);
      Logger.debug(`📅 Updated IB portfolio last refresh time for account ${mainAccountId}`);
    } catch (error) {
      Logger.error('❌ Failed to update IB portfolio time:', error);
    }
  }

  /**
   * Update manual investments last refresh time for specific account
   */
  static async updateManualInvestmentsTime(mainAccountId?: number): Promise<void> {
    if (!mainAccountId) {
      Logger.warn('⚠️ No account ID provided for manual investments update - skipping');
      return;
    }
    
    try {
      const { dbRun } = await import('../database/connection.js');
      await dbRun(`
        INSERT OR REPLACE INTO last_updates (main_account_id, update_type, last_updated, updated_at)
        VALUES (?, 'MANUAL_PORTFOLIO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [mainAccountId]);
      Logger.debug(`📅 Updated manual investments last refresh time for account ${mainAccountId}`);
    } catch (error) {
      Logger.error('❌ Failed to update manual investments time:', error);
    }
  }

  /**
   * Get all last update times (for backward compatibility - now requires account ID for account-specific data)
   */
  static async getAllLastUpdateTimes(mainAccountId?: number): Promise<{
    currency: string | null;
    ibPortfolio: string | null;
    manualInvestments: string | null;
    currencyTimestamp: number | null;
    ibPortfolioTimestamp: number | null;
    manualInvestmentsTimestamp: number | null;
  }> {
    try {
      const [currency, ibPortfolio, manualInvestments] = await Promise.all([
        this.getCurrencyLastUpdate(),
        mainAccountId ? this.getIBPortfolioLastUpdate(mainAccountId) : null,
        mainAccountId ? this.getManualInvestmentsLastUpdate(mainAccountId) : null
      ]);

      return {
        currency,
        ibPortfolio,
        manualInvestments,
        currencyTimestamp: currency ? new Date(currency).getTime() : null,
        ibPortfolioTimestamp: ibPortfolio ? new Date(ibPortfolio).getTime() : null,
        manualInvestmentsTimestamp: manualInvestments ? new Date(manualInvestments).getTime() : null
      };
    } catch (error) {
      Logger.error('❌ Failed to get all last update times:', error);
      return {
        currency: null,
        ibPortfolio: null,
        manualInvestments: null,
        currencyTimestamp: null,
        ibPortfolioTimestamp: null,
        manualInvestmentsTimestamp: null
      };
    }
  }

  /**
   * Get currency last update time (global)
   */
  static async getCurrencyLastUpdate(): Promise<string | null> {
    try {
      const { dbGet } = await import('../database/connection.js');
      const row = await dbGet(
        'SELECT last_updated FROM last_updates WHERE main_account_id IS NULL AND update_type = ?',
        ['EXCHANGE_RATES']
      );
      return row ? new Date(row.last_updated).toISOString() : null;
    } catch (error) {
      Logger.error('❌ Failed to get currency last update:', error);
      return null;
    }
  }

  /**
   * Get IB portfolio last update time for specific account
   */
  static async getIBPortfolioLastUpdate(mainAccountId: number): Promise<string | null> {
    try {
      const { dbGet } = await import('../database/connection.js');
      const row = await dbGet(
        'SELECT last_updated FROM last_updates WHERE main_account_id = ? AND update_type = ?',
        [mainAccountId, 'IB_PORTFOLIO']
      );
      return row ? new Date(row.last_updated).toISOString() : null;
    } catch (error) {
      Logger.error('❌ Failed to get IB portfolio last update:', error);
      return null;
    }
  }

  /**
   * Get manual investments last update time for specific account
   */
  static async getManualInvestmentsLastUpdate(mainAccountId: number): Promise<string | null> {
    try {
      const { dbGet } = await import('../database/connection.js');
      const row = await dbGet(
        'SELECT last_updated FROM last_updates WHERE main_account_id = ? AND update_type = ?',
        [mainAccountId, 'MANUAL_PORTFOLIO']
      );
      return row ? new Date(row.last_updated).toISOString() : null;
    } catch (error) {
      Logger.error('❌ Failed to get manual investments last update:', error);
      return null;
    }
  }

  /**
   * Get time since last update in minutes
   */
  static async getTimeSinceLastUpdate(type: 'currency' | 'ibPortfolio' | 'manualInvestments', mainAccountId?: number): Promise<number | null> {
    try {
      let lastUpdate: string | null = null;
      
      switch (type) {
        case 'currency':
          lastUpdate = await this.getCurrencyLastUpdate();
          break;
        case 'ibPortfolio':
          if (!mainAccountId) return null;
          lastUpdate = await this.getIBPortfolioLastUpdate(mainAccountId);
          break;
        case 'manualInvestments':
          if (!mainAccountId) return null;
          lastUpdate = await this.getManualInvestmentsLastUpdate(mainAccountId);
          break;
      }
      
      if (!lastUpdate) return null;
      return Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000 / 60);
    } catch (error) {
      Logger.error('❌ Failed to get time since last update:', error);
      return null;
    }
  }

  /**
   * Check if data needs refresh (older than 30 minutes)
   */
  static async needsRefresh(type: 'currency' | 'ibPortfolio' | 'manualInvestments', mainAccountId?: number): Promise<boolean> {
    const timeSinceUpdate = await this.getTimeSinceLastUpdate(type, mainAccountId);
    return timeSinceUpdate === null || timeSinceUpdate >= 30;
  }
}