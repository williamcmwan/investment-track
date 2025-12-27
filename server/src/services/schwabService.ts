import axios from 'axios';
import { Logger } from '../utils/logger.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schwab API base URL
const SCHWAB_API_BASE = 'https://api.schwabapi.com';

interface SchwabTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
}

interface SchwabUserSettings {
  user_id: number;
  app_key: string;
  app_secret: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
}

export class SchwabService {
  private static db: Database.Database;

  private static getDb(): Database.Database {
    if (!this.db) {
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/investment_tracker.db');
      this.db = new Database(dbPath);
    }
    return this.db;
  }

  /**
   * Get user's Schwab settings from database
   */
  static async getUserSettings(userId: number): Promise<SchwabUserSettings | null> {
    const db = this.getDb();
    const row = db.prepare(`
      SELECT user_id, app_key, app_secret, access_token, refresh_token, token_expires_at
      FROM schwab_settings
      WHERE user_id = ?
    `).get(userId) as SchwabUserSettings | undefined;

    return row || null;
  }

  /**
   * Save user's Schwab settings
   */
  static async saveUserSettings(userId: number, settings: {
    app_key: string;
    app_secret: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: number;
  }): Promise<void> {
    const db = this.getDb();
    
    db.prepare(`
      INSERT INTO schwab_settings (user_id, app_key, app_secret, access_token, refresh_token, token_expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        app_key = excluded.app_key,
        app_secret = excluded.app_secret,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      userId,
      settings.app_key,
      settings.app_secret,
      settings.access_token || null,
      settings.refresh_token || null,
      settings.token_expires_at || null
    );
  }

  /**
   * Update tokens in database
   */
  private static async updateTokens(userId: number, tokens: SchwabTokens): Promise<void> {
    const db = this.getDb();
    
    db.prepare(`
      UPDATE schwab_settings
      SET access_token = ?,
          refresh_token = ?,
          token_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(tokens.access_token, tokens.refresh_token, tokens.expires_at, userId);
  }

  /**
   * Check if access token is expired or about to expire (within 5 minutes)
   */
  private static isTokenExpired(expiresAt?: number): boolean {
    if (!expiresAt) return true;
    const now = Math.floor(Date.now() / 1000);
    return expiresAt - now < 300; // Refresh if less than 5 minutes remaining
  }

  /**
   * Proactively refresh tokens for all Schwab accounts to keep them alive
   * This should be called periodically (e.g., every 20 minutes) to prevent token expiration
   */
  static async proactiveTokenRefresh(): Promise<void> {
    try {
      Logger.info('🔄 Starting proactive Schwab token refresh...');
      
      const { dbAll } = await import('../database/connection.js');
      
      // Get all accounts with Schwab integration
      const accounts = await dbAll(
        `SELECT id, user_id as userId, name, integration_config as integrationConfig
         FROM accounts 
         WHERE integration_type = 'SCHWAB'
         AND integration_config IS NOT NULL`
      ) as Array<{ id: number; userId: number; name: string; integrationConfig: string }>;
      
      if (accounts.length === 0) {
        Logger.debug('ℹ️  No Schwab accounts found for proactive refresh');
        return;
      }

      Logger.info(`📊 Found ${accounts.length} Schwab account(s) for proactive token refresh`);
      
      let refreshedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const account of accounts) {
        try {
          const config = JSON.parse(account.integrationConfig);
          
          if (!config.refreshToken) {
            Logger.debug(`⏭️  Skipping account ${account.name}: No refresh token`);
            skippedCount++;
            continue;
          }

          // Check if token will expire in the next 25 minutes (proactive refresh window)
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = config.tokenExpiresAt || 0;
          const timeUntilExpiry = expiresAt - now;
          
          // Refresh if token expires within 25 minutes (1500 seconds)
          if (timeUntilExpiry > 1500) {
            Logger.debug(`⏭️  Skipping account ${account.name}: Token still valid for ${Math.floor(timeUntilExpiry / 60)} minutes`);
            skippedCount++;
            continue;
          }

          Logger.info(`🔄 Proactively refreshing token for account ${account.name} (expires in ${Math.floor(timeUntilExpiry / 60)} minutes)`);
          
          // Trigger token refresh by calling getValidAccessTokenForAccount
          await this.getValidAccessTokenForAccount(account.id, account.userId);
          
          refreshedCount++;
          Logger.info(`✅ Proactively refreshed token for account ${account.name}`);
        } catch (error: any) {
          Logger.error(`❌ Failed to proactively refresh token for account ${account.name}:`, error.message);
          errorCount++;
        }
      }

      Logger.info(`✅ Proactive token refresh completed: ${refreshedCount} refreshed, ${skippedCount} skipped, ${errorCount} failed`);
    } catch (error: any) {
      Logger.error('❌ Error in proactive token refresh:', error);
    }
  }

  /**
   * Check token expiration status for all Schwab accounts
   * Returns accounts that need re-authentication soon (within specified days)
   * Schwab refresh tokens expire after 7 days - this is a Schwab limitation
   */
  static async checkTokenExpirationStatus(warningDays: number = 2): Promise<{
    accountId: number;
    accountName: string;
    userId: number;
    daysUntilExpiry: number;
    needsReauth: boolean;
    lastRefreshed?: string;
  }[]> {
    try {
      const { dbAll } = await import('../database/connection.js');
      
      const accounts = await dbAll(
        `SELECT id, user_id as userId, name, integration_config as integrationConfig, updated_at as updatedAt
         FROM accounts 
         WHERE integration_type = 'SCHWAB'
         AND integration_config IS NOT NULL`
      ) as Array<{ id: number; userId: number; name: string; integrationConfig: string; updatedAt: string }>;
      
      const results = [];
      const now = Math.floor(Date.now() / 1000);
      const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
      
      for (const account of accounts) {
        try {
          const config = JSON.parse(account.integrationConfig);
          
          if (!config.refreshToken || !config.tokenExpiresAt) {
            results.push({
              accountId: account.id,
              accountName: account.name,
              userId: account.userId,
              daysUntilExpiry: 0,
              needsReauth: true,
              lastRefreshed: account.updatedAt
            });
            continue;
          }
          
          // Estimate refresh token expiry: ~7 days from when it was issued
          // We approximate this by adding 7 days to the access token expiry minus 30 min
          // (access tokens typically expire in 30 min)
          const accessTokenExpiresAt = config.tokenExpiresAt;
          const estimatedRefreshTokenIssuedAt = accessTokenExpiresAt - 1800; // 30 min before access expiry
          const estimatedRefreshTokenExpiresAt = estimatedRefreshTokenIssuedAt + SEVEN_DAYS_SECONDS;
          
          const secondsUntilExpiry = estimatedRefreshTokenExpiresAt - now;
          const daysUntilExpiry = Math.max(0, Math.floor(secondsUntilExpiry / (24 * 60 * 60)));
          
          results.push({
            accountId: account.id,
            accountName: account.name,
            userId: account.userId,
            daysUntilExpiry,
            needsReauth: daysUntilExpiry <= warningDays,
            lastRefreshed: account.updatedAt
          });
        } catch {
          results.push({
            accountId: account.id,
            accountName: account.name,
            userId: account.userId,
            daysUntilExpiry: 0,
            needsReauth: true
          });
        }
      }
      
      // Log warnings for accounts needing re-auth soon
      const needsReauth = results.filter(r => r.needsReauth);
      if (needsReauth.length > 0) {
        Logger.warn(`⚠️  ${needsReauth.length} Schwab account(s) need re-authentication within ${warningDays} days:`);
        needsReauth.forEach(r => {
          Logger.warn(`   - ${r.accountName}: ${r.daysUntilExpiry} days remaining`);
        });
      }
      
      return results;
    } catch (error: any) {
      Logger.error('❌ Error checking token expiration status:', error);
      return [];
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private static async refreshAccessToken(userId: number, settings: SchwabUserSettings): Promise<string> {
    if (!settings.refresh_token) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    try {
      // Schwab requires Basic Authentication (Base64 encoded client_id:client_secret)
      const credentials = Buffer.from(`${settings.app_key}:${settings.app_secret}`).toString('base64');
      
      const response = await axios.post(`${SCHWAB_API_BASE}/v1/oauth/token`, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: settings.refresh_token
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expires_at = Math.floor(Date.now() / 1000) + expires_in;

      await this.updateTokens(userId, {
        access_token,
        refresh_token: refresh_token || settings.refresh_token, // Use new refresh token if provided
        expires_at
      });

      Logger.info('✅ Schwab access token refreshed successfully');
      return access_token;
    } catch (error: any) {
      Logger.error('❌ Failed to refresh Schwab access token:', error);
      
      // Log more details for debugging
      if (error.response) {
        Logger.error(`Status: ${error.response.status}`);
        Logger.error(`Response data:`, error.response.data);
        Logger.error(`Response headers:`, error.response.headers);
      }
      
      // Check for specific error types
      const errorData = error.response?.data;
      if (errorData?.error === 'unsupported_token_type' || 
          errorData?.error === 'refresh_token_authentication_error' ||
          errorData?.error_description?.includes('refresh token')) {
        throw new Error('Refresh token expired or invalid. Please re-authenticate through the integration settings.');
      }
      
      throw new Error('Failed to refresh access token. Please re-authenticate.');
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private static async getValidAccessToken(userId: number): Promise<string> {
    const settings = await this.getUserSettings(userId);
    
    if (!settings) {
      throw new Error('Schwab not configured. Please configure your Schwab settings first.');
    }

    if (!settings.access_token) {
      throw new Error('No access token available. Please complete OAuth authentication.');
    }

    // Check if token needs refresh
    if (this.isTokenExpired(settings.token_expires_at)) {
      return await this.refreshAccessToken(userId, settings);
    }

    return settings.access_token;
  }

  /**
   * Get all account numbers
   */
  static async getAccountNumbers(userId: number): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await axios.get(`${SCHWAB_API_BASE}/trader/v1/accounts/accountNumbers`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      Logger.info('✅ Retrieved Schwab account numbers');
      return response.data;
    } catch (error: any) {
      Logger.error('❌ Failed to get Schwab account numbers:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get account details including balances
   */
  static async getAccountBalance(userId: number, accountHash: string): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await axios.get(
        `${SCHWAB_API_BASE}/trader/v1/accounts/${accountHash}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'positions' // Include positions for complete data
          }
        }
      );

      const accountData = response.data.securitiesAccount;
      
      Logger.info(`✅ Retrieved Schwab account balance: ${accountData.currentBalances.liquidationValue}`);
      
      return {
        accountNumber: accountData.accountNumber,
        accountType: accountData.type,
        currentBalance: accountData.currentBalances.liquidationValue,
        cashBalance: accountData.currentBalances.cashBalance,
        buyingPower: accountData.currentBalances.buyingPower,
        equity: accountData.currentBalances.equity,
        currency: 'USD', // Schwab accounts are USD
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      Logger.error('❌ Failed to get Schwab account balance:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get all positions for an account
   */
  static async getPositions(userId: number, accountHash: string): Promise<any[]> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await axios.get(
        `${SCHWAB_API_BASE}/trader/v1/accounts/${accountHash}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'positions'
          }
        }
      );

      const positions = response.data.securitiesAccount.positions || [];
      
      Logger.info(`✅ Retrieved ${positions.length} Schwab positions`);
      
      return positions.map((pos: any) => ({
        symbol: pos.instrument.symbol,
        description: pos.instrument.description,
        assetType: pos.instrument.assetType,
        quantity: pos.longQuantity || pos.shortQuantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.marketValue / (pos.longQuantity || pos.shortQuantity || 1),
        marketValue: pos.marketValue,
        profitLoss: pos.currentDayProfitLoss,
        profitLossPercent: pos.currentDayProfitLossPercentage,
        currency: 'USD'
      }));
    } catch (error: any) {
      Logger.error('❌ Failed to get Schwab positions:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get real-time quotes for symbols
   */
  static async getQuotes(userId: number, symbols: string[]): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await axios.get(`${SCHWAB_API_BASE}/marketdata/v1/quotes`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          symbols: symbols.join(','),
          fields: 'quote,fundamental'
        }
      });

      Logger.info(`✅ Retrieved quotes for ${symbols.length} symbols`);
      return response.data;
    } catch (error: any) {
      Logger.error('❌ Failed to get Schwab quotes:', error.response?.data || error.message);
      throw error;
    }
  }

  // ============================================================================
  // Account-Level Token Methods (New)
  // ============================================================================

  /**
   * Refresh access token using account-level integration config
   */
  private static async refreshAccessTokenForAccount(
    accountId: number,
    userId: number,
    config: any
  ): Promise<string> {
    if (!config.refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    try {
      const credentials = Buffer.from(`${config.appKey}:${config.appSecret}`).toString('base64');
      
      const response = await axios.post(`${SCHWAB_API_BASE}/v1/oauth/token`, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expires_at = Math.floor(Date.now() / 1000) + expires_in;

      const { AccountModel } = await import('../models/Account.js');
      await AccountModel.setIntegration(accountId, userId, 'SCHWAB', {
        type: 'SCHWAB',
        appKey: config.appKey,
        appSecret: config.appSecret,
        accessToken: access_token,
        refreshToken: refresh_token || config.refreshToken,
        tokenExpiresAt: expires_at,
        accountHash: config.accountHash
      });

      Logger.info(`✅ Refreshed Schwab token for account ${accountId}`);
      return access_token;
    } catch (error: any) {
      Logger.error(`❌ Failed to refresh token for account ${accountId}:`, error);
      
      const errorData = error.response?.data;
      if (errorData?.error === 'unsupported_token_type' || 
          errorData?.error === 'refresh_token_authentication_error' ||
          errorData?.error_description?.includes('refresh token')) {
        throw new Error('Refresh token expired. Please re-authenticate.');
      }
      
      throw new Error('Failed to refresh access token.');
    }
  }

  /**
   * Get valid access token for account (refresh if needed)
   */
  static async getValidAccessTokenForAccount(accountId: number, userId: number): Promise<string> {
    const { AccountModel } = await import('../models/Account.js');
    const config = await AccountModel.getIntegration(accountId, userId);
    
    if (!config || config.type !== 'SCHWAB') {
      throw new Error('Schwab integration not configured.');
    }

    const schwabConfig = config as any;

    if (!schwabConfig.accessToken) {
      throw new Error('No access token. Please complete OAuth authentication.');
    }

    if (this.isTokenExpired(schwabConfig.tokenExpiresAt)) {
      return await this.refreshAccessTokenForAccount(accountId, userId, schwabConfig);
    }

    return schwabConfig.accessToken;
  }

  /**
   * Get account balance using account-level tokens
   */
  static async getAccountBalanceForAccount(accountId: number, userId: number, accountHash: string): Promise<any> {
    try {
      const accessToken = await this.getValidAccessTokenForAccount(accountId, userId);

      const response = await axios.get(
        `${SCHWAB_API_BASE}/trader/v1/accounts/${accountHash}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'positions'
          }
        }
      );

      const accountData = response.data.securitiesAccount;
      
      Logger.info(`✅ Retrieved Schwab balance for account ${accountId}: ${accountData.currentBalances.liquidationValue}`);
      
      return {
        accountNumber: accountData.accountNumber,
        accountType: accountData.type,
        currentBalance: accountData.currentBalances.liquidationValue,
        cashBalance: accountData.currentBalances.cashBalance,
        buyingPower: accountData.currentBalances.buyingPower,
        equity: accountData.currentBalances.equity,
        currency: 'USD',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      Logger.error(`❌ Failed to get balance for account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get positions using account-level tokens
   */
  static async getPositionsForAccount(accountId: number, userId: number, accountHash: string): Promise<any[]> {
    try {
      const accessToken = await this.getValidAccessTokenForAccount(accountId, userId);

      const response = await axios.get(
        `${SCHWAB_API_BASE}/trader/v1/accounts/${accountHash}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            fields: 'positions'
          }
        }
      );

      const positions = response.data.securitiesAccount.positions || [];
      
      Logger.info(`✅ Retrieved ${positions.length} positions for account ${accountId}`);
      
      return positions.map((pos: any) => {
        const quantity = pos.longQuantity || pos.shortQuantity || 0;
        const marketPrice = quantity > 0 ? pos.marketValue / quantity : 0;
        const assetType = pos.instrument.assetType;
        const isBond = assetType === 'BOND' || assetType === 'FIXED_INCOME';
        
        // For bonds, Schwab's averagePrice is in different scale (needs *10 to match marketPrice)
        const adjustedAvgCost = isBond ? (pos.averagePrice || 0) * 10 : (pos.averagePrice || 0);
        const costBasis = adjustedAvgCost * quantity;
        const unrealizedPNL = (pos.marketValue || 0) - costBasis;
        
        // Calculate day change from netChange (price change per share) * quantity
        const netChange = pos.instrument?.netChange || 0;
        const dayChange = netChange * quantity;
        
        // Calculate day change percentage: (netChange / previous close price) * 100
        // Previous close = current price - netChange
        const previousClose = marketPrice - netChange;
        const dayChangePercent = previousClose > 0 ? (netChange / previousClose) * 100 : 0;
        
        return {
          symbol: pos.instrument.symbol,
          secType: assetType,
          currency: 'USD',
          position: quantity,
          averageCost: pos.averagePrice || 0, // Keep original for display
          adjustedAvgCost: adjustedAvgCost, // Add adjusted cost for calculations
          marketPrice: marketPrice,
          marketValue: pos.marketValue || 0,
          unrealizedPNL: unrealizedPNL,
          realizedPNL: 0,
          dayChange: dayChange,
          dayChangePercent: dayChangePercent
        };
      });
    } catch (error: any) {
      Logger.error(`❌ Failed to get positions for account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Refresh portfolio data for a Schwab account
   * Fetches balance and updates the account (reuses same logic as manual refresh)
   */
  static async refreshPortfolio(accountId: number, userId: number): Promise<void> {
    try {
      Logger.debug(`🔄 Refreshing Schwab portfolio for account ${accountId}...`);
      
      const { AccountModel } = await import('../models/Account.js');
      const config = await AccountModel.getIntegration(accountId, userId);
      
      if (!config || config.type !== 'SCHWAB') {
        throw new Error('Schwab integration not configured.');
      }

      const schwabConfig = config as any;
      if (!schwabConfig.accountHash) {
        throw new Error('Account hash not configured.');
      }

      // Fetch balance using the same method as manual refresh
      const result = await this.getAccountBalanceForAccount(accountId, userId, schwabConfig.accountHash);
      
      if (result && result.currentBalance) {
        // Use AccountModel helper to update balance and add history
        await AccountModel.updateBalanceWithHistory(
          accountId,
          userId,
          result.currentBalance,
          'Schwab scheduled refresh'
        );

        Logger.info(`✅ Refreshed Schwab portfolio for account ${accountId}: $${result.currentBalance.toFixed(2)}`);
      } else {
        throw new Error('Failed to get balance from Schwab API');
      }
    } catch (error: any) {
      Logger.error(`❌ Failed to refresh Schwab portfolio for account ${accountId}:`, error.message);
      throw error;
    }
  }
  /**
   * Refresh all Schwab accounts for all users
   */
  static async refreshAllAccounts(): Promise<void> {
    try {
      Logger.debug('🔄 Refreshing all Schwab accounts...');
      
      const { AccountModel } = await import('../models/Account.js');
      const { dbAll } = await import('../database/connection.js');
      
      // Get all accounts with Schwab integration
      const accounts = await dbAll(
        `SELECT id, user_id as userId, name, integration_config as integrationConfig
         FROM accounts 
         WHERE integration_type = 'SCHWAB'
         AND integration_config IS NOT NULL`
      ) as Array<{ id: number; userId: number; name: string; integrationConfig: string }>;
      
      if (accounts.length === 0) {
        Logger.debug('ℹ️  No Schwab accounts found to refresh');
        return;
      }

      Logger.info(`📊 Found ${accounts.length} Schwab account(s) to refresh`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const account of accounts) {
        try {
          await this.refreshPortfolio(account.id, account.userId);
          successCount++;
        } catch (error: any) {
          Logger.error(`❌ Failed to refresh Schwab account ${account.name} (ID: ${account.id}):`, error.message);
          errorCount++;
        }
      }

      Logger.info(`✅ Schwab refresh completed: ${successCount} successful, ${errorCount} failed`);
    } catch (error: any) {
      Logger.error('❌ Error refreshing Schwab accounts:', error);
      throw error;
    }
  }
}
