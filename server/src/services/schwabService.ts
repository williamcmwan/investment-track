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
        const costBasis = (pos.averagePrice || 0) * quantity;
        const unrealizedPNL = (pos.marketValue || 0) - costBasis;
        
        // Calculate day change
        const currentDayProfitLoss = pos.currentDayProfitLoss || 0;
        const previousDayValue = (pos.marketValue || 0) - currentDayProfitLoss;
        const dayChangePercent = previousDayValue > 0 
          ? (currentDayProfitLoss / previousDayValue) * 100 
          : 0;
        
        return {
          symbol: pos.instrument.symbol,
          secType: pos.instrument.assetType,
          currency: 'USD',
          position: quantity,
          averageCost: pos.averagePrice || 0,
          marketPrice: marketPrice,
          marketValue: pos.marketValue || 0,
          unrealizedPNL: unrealizedPNL,
          realizedPNL: 0,
          dayChange: currentDayProfitLoss,
          dayChangePercent: dayChangePercent,
          currentDayProfitLoss: currentDayProfitLoss,
          currentDayProfitLossPercentage: pos.currentDayProfitLossPercentage || dayChangePercent
        };
      });
    } catch (error: any) {
      Logger.error(`❌ Failed to get positions for account ${accountId}:`, error.response?.data || error.message);
      throw error;
    }
  }
}
