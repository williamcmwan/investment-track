import { IBApi, EventName, ErrorCode } from '@stoqey/ib';
import { Logger } from '../utils/logger.js';
import { IBRequestThrottler } from './ibRequestThrottler.js';

interface AccountSummary {
  balance: number;
  currency: string;
  netLiquidation?: number;
  totalCashValue?: number;
}

interface PortfolioPosition {
  symbol: string;
  secType: string;
  currency: string;
  position: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPNL: number;
  realizedPNL: number;
  exchange?: string;
  primaryExchange?: string;
  conId?: number;
  industry?: string;
  category?: string;
  country?: string;
  closePrice?: number;
  dayChange?: number;
  dayChangePercent?: number;
}

interface CashBalance {
  currency: string;
  amount: number;
  marketValueHKD: number;
  marketValueUSD?: number;
}

export class IBService {
  private static ibApi: IBApi | null = null;
  private static isConnected = false;
  private static isConnecting = false;
  private static connectionPromise: Promise<void> | null = null;
  private static lastConnectionAttempt = 0;
  private static connectionRetryDelay = 5000; // 5 seconds between retry attempts
  private static accountSummaryData: Map<string, string> = new Map();
  private static activeReqId: number | null = null;
  private static isRequestInProgress = false;
  private static lastReqId = 0;
  private static portfolioPositions: PortfolioPosition[] = [];
  private static cashBalances: CashBalance[] = [];
  private static isPortfolioRequestInProgress = false;
  private static keepAliveInterval: NodeJS.Timeout | null = null;
  private static lastActivityTime = 0;
  private static readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes idle timeout

  // Track failed bond market data requests to avoid repeated timeouts
  private static failedBondSymbols: Set<string> = new Set();

  // No cache - all data comes from database

  // Get user-specific connection settings
  static getUserConnectionSettings(userSettings?: { host: string; port: number; client_id: number }): { host: string; port: number; clientId: number } {
    if (!userSettings) {
      throw new Error('User IB settings are required but not provided');
    }
    return {
      host: userSettings.host,
      port: userSettings.port,
      clientId: userSettings.client_id
    };
  }

  // Initialize connection on server startup (optional - connection will be created on first use)
  static async initialize(): Promise<void> {
    try {
      Logger.info('🚀 Initializing IB Service...');
      // Don't connect immediately, let it connect on first request
      // This avoids connection issues if IB Gateway isn't running at startup
      Logger.info('✅ IB Service initialized (connection will be established on first request)');
    } catch (error) {
      Logger.error('❌ Failed to initialize IB Service:', error);
    }
  }

  // Graceful shutdown
  static async shutdown(): Promise<void> {
    Logger.info('🛑 Shutting down IB Service...');
    await this.disconnect();
    Logger.info('✅ IB Service shutdown complete');
  }

  // Database operations - no cache, always fresh from DB

  // Update last refresh time in database
  private static async updateLastRefreshTime(mainAccountId: number, updateType: string): Promise<void> {
    try {
      const { dbRun } = await import('../database/connection.js');
      await dbRun(`
        INSERT OR REPLACE INTO last_updates (main_account_id, update_type, last_updated, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [mainAccountId, updateType]);
      Logger.debug(`📅 Updated last refresh time for ${updateType} (account ${mainAccountId})`);
    } catch (error) {
      Logger.error('❌ Failed to update last refresh time:', error);
    }
  }

  // Get last refresh time from database
  private static async getLastRefreshTime(mainAccountId: number, updateType: string): Promise<Date | null> {
    try {
      const { dbGet } = await import('../database/connection.js');
      const row = await dbGet(`
        SELECT last_updated FROM last_updates 
        WHERE main_account_id = ? AND update_type = ?
      `, [mainAccountId, updateType]);
      return row ? new Date(row.last_updated) : null;
    } catch (error) {
      Logger.error('❌ Failed to get last refresh time:', error);
      return null;
    }
  }

  // Persist IB portfolio to DB (source = 'IB') for a given main account
  private static async savePortfolioToDB(mainAccountId: number, positions: PortfolioPosition[]): Promise<void> {
    try {
      const { dbRun } = await import('../database/connection.js');

      Logger.info(`💾 Starting batch save of ${positions.length} IB portfolio positions to DB...`);
      const startTime = Date.now();

      // Replace existing IB records for this account
      await dbRun('DELETE FROM portfolios WHERE source = ? AND main_account_id = ?', ['IB', mainAccountId]);

      if (positions.length === 0) {
        Logger.info('💾 No positions to save');
        return;
      }

      // Build batch INSERT with multiple VALUES clauses
      const baseInsertSql = `
        INSERT INTO portfolios (
          main_account_id, symbol, sec_type, currency, country, industry, category,
          quantity, average_cost, exchange, primary_exchange, con_id,
          market_price, market_value, day_change, day_change_percent, close_price,
          unrealized_pnl, realized_pnl, notes, source, last_price_update, updated_at, created_at
        ) VALUES 
      `;

      // Create VALUES clauses and collect all parameters
      const valueClauses: string[] = [];
      const allParams: any[] = [];

      for (const p of positions) {
        valueClauses.push(`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);

        allParams.push(
          mainAccountId,
          p.symbol || '',
          p.secType || '',
          p.currency || 'USD',
          p.country || null,
          p.industry || null,
          p.category || null,
          p.position ?? 0, // quantity from IB 'position'
          p.averageCost ?? 0,
          p.exchange || null,
          p.primaryExchange || null,
          p.conId || null,
          p.marketPrice ?? null,
          p.marketValue ?? null,
          p.dayChange ?? null,
          p.dayChangePercent ?? null,
          p.closePrice ?? null,
          p.unrealizedPNL ?? null,
          p.realizedPNL ?? null,
          null, // notes
          'IB'
        );
      }

      // Execute single batch INSERT
      const batchInsertSql = baseInsertSql + valueClauses.join(', ');
      await dbRun(batchInsertSql, allParams);

      const endTime = Date.now();
      const duration = endTime - startTime;
      Logger.info(`💾 Batch saved ${positions.length} IB portfolio rows to DB for account ${mainAccountId} in ${duration}ms`);

    } catch (e) {
      Logger.error('❌ Failed to save IB portfolio to DB:', e);
    }
  }

  // Load IB portfolio from DB; if mainAccountId provided, filter by it
  private static async loadPortfolioFromDB(mainAccountId?: number | null): Promise<PortfolioPosition[]> {
    try {
      const { dbAll } = await import('../database/connection.js');
      let rows: any[];
      if (mainAccountId != null) {
        rows = await dbAll(
          'SELECT * FROM portfolios WHERE source = ? AND main_account_id = ? ORDER BY symbol',
          ['IB', mainAccountId]
        );
      } else {
        rows = await dbAll(
          'SELECT * FROM portfolios WHERE source = ? ORDER BY main_account_id, symbol',
          ['IB']
        );
      }
      const positions: PortfolioPosition[] = rows.map((row: any) => ({
        symbol: row.symbol,
        secType: row.sec_type,
        currency: row.currency,
        position: row.quantity,
        averageCost: row.average_cost,
        marketPrice: row.market_price || 0,
        marketValue: row.market_value || 0,
        unrealizedPNL: row.unrealized_pnl || 0,
        realizedPNL: row.realized_pnl || 0,
        exchange: row.exchange || undefined,
        primaryExchange: row.primary_exchange || undefined,
        conId: row.con_id || undefined,
        industry: row.industry || undefined,
        category: row.category || undefined,
        country: row.country || undefined,
        closePrice: row.close_price || undefined,
        dayChange: row.day_change || undefined,
        dayChangePercent: row.day_change_percent || undefined
      }));
      Logger.info(`📥 Loaded ${positions.length} IB portfolio rows from DB${mainAccountId != null ? ' for account ' + mainAccountId : ''}`);
      return positions;
    } catch (e) {
      Logger.error('❌ Failed to load IB portfolio from DB:', e);
      return [];
    }
  }

  // Force cancel all known subscriptions (use if you get "maximum requests exceeded")
  static async forceCleanup(): Promise<void> {
    if (this.ibApi && this.isConnected) {
      // Try to cancel with multiple possible IDs
      for (let i = 0; i < 10; i++) {
        try {
          this.ibApi.cancelAccountSummary(i);
        } catch (err) {
          // Ignore errors
        }
      }
      // Also try the last known ID
      if (this.activeReqId !== null) {
        try {
          this.ibApi.cancelAccountSummary(this.activeReqId);
        } catch (err) {
          // Ignore errors
        }
      }
      this.activeReqId = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private static async connect(userSettings?: { host: string; port: number; client_id: number }): Promise<void> {
    // If already connected, update activity time and return
    if (this.isConnected && this.ibApi) {
      Logger.info('✅ Already connected to IB Gateway, reusing persistent connection');
      this.lastActivityTime = Date.now();
      return;
    }

    // If already connecting, wait for that connection to complete
    if (this.isConnecting && this.connectionPromise) {
      Logger.info('⏳ Connection in progress, waiting...');
      return this.connectionPromise;
    }

    // Enforce delay between connection attempts to avoid rate limiting
    const timeSinceLastAttempt = Date.now() - this.lastConnectionAttempt;
    if (timeSinceLastAttempt < this.connectionRetryDelay) {
      const waitTime = this.connectionRetryDelay - timeSinceLastAttempt;
      Logger.info(`⏱️  Waiting ${waitTime}ms before reconnection attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastConnectionAttempt = Date.now();
    this.isConnecting = true;

    // If there's an existing API instance but not connected, clean it up
    if (this.ibApi && !this.isConnected) {
      try {
        Logger.info('🧹 Cleaning up disconnected IB API instance...');
        this.ibApi.removeAllListeners();
        this.ibApi.disconnect();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        Logger.error('Error cleaning up:', err);
      }
      this.ibApi = null;
    }

    const settings = this.getUserConnectionSettings(userSettings);
    Logger.info(`🔌 Connecting to IB Gateway at ${settings.host}:${settings.port} with client ID ${settings.clientId}...`);

    this.connectionPromise = new Promise((resolve, reject) => {
      this.ibApi = new IBApi({
        host: settings.host,
        port: settings.port,
        clientId: settings.clientId
      });

      const timeout = setTimeout(() => {
        Logger.error('❌ Connection timeout - cleaning up...');
        this.cleanupConnection();
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(new Error('Connection timeout - ensure TWS/Gateway is running'));
      }, 20000);

      this.ibApi!.on(EventName.connected, () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.lastActivityTime = Date.now();
        clearTimeout(timeout);
        Logger.info('✅ Successfully connected to IB Gateway - maintaining persistent connection');

        // Start keep-alive mechanism
        this.startKeepAlive();

        resolve();
      });

      this.ibApi!.on(EventName.disconnected, () => {
        Logger.info('⚠️  Disconnected from IB Gateway');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopKeepAlive();
      });

      this.ibApi!.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
        Logger.error(`❌ IB API Error [${code}]:`, err.message);

        // Handle pacing violations (error 162) and data farm disconnections (error 420)
        const errorCode = code as unknown as number;
        if (errorCode === 162 || errorCode === 420) {
          IBRequestThrottler.markPacingViolation(errorCode);
        }

        // Handle "client id already in use" error
        if (err.message.includes('client id is already in use')) {
          clearTimeout(timeout);
          this.cleanupConnection();
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error('Client ID already in use. Please disconnect other applications or change IB_CLIENT_ID in .env'));
        } else if (!this.isConnected && this.isConnecting) {
          clearTimeout(timeout);
          this.cleanupConnection();
          this.isConnecting = false;
          this.connectionPromise = null;
          reject(new Error(`IB API Error: ${err.message}`));
        }
      });

      try {
        this.ibApi!.connect();
      } catch (err) {
        clearTimeout(timeout);
        Logger.error('❌ Error calling connect():', err);
        this.cleanupConnection();
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  // Clean up connection without disconnecting (for error cases)
  private static cleanupConnection(): void {
    if (this.ibApi) {
      this.ibApi.removeAllListeners();
      try {
        this.ibApi.disconnect();
      } catch (e) {
        // Ignore
      }
    }
    this.ibApi = null;
    this.isConnected = false;
    this.stopKeepAlive();
  }

  // Start keep-alive mechanism to maintain connection
  private static startKeepAlive(): void {
    if (this.keepAliveInterval) {
      return;
    }

    Logger.info('🔄 Starting keep-alive mechanism');

    // Check connection health every 5 minutes
    this.keepAliveInterval = setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;

      if (idleTime > this.IDLE_TIMEOUT) {
        Logger.info(`⏰ Connection idle for ${Math.round(idleTime / 60000)} minutes, disconnecting...`);
        this.disconnect();
      } else {
        Logger.debug(`💓 Connection alive, idle for ${Math.round(idleTime / 60000)} minutes`);
      }
    }, 5 * 60 * 1000);
  }

  // Stop keep-alive mechanism
  private static stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      Logger.info('🛑 Stopped keep-alive mechanism');
    }
  }

  static async disconnect(): Promise<void> {
    Logger.info('🔌 Disconnecting from IB Gateway...');

    this.stopKeepAlive();

    if (this.ibApi) {
      // Cancel any active account summary request
      if (this.activeReqId !== null) {
        try {
          this.ibApi.cancelAccountSummary(this.activeReqId);
        } catch (err) {
          Logger.error('Error canceling account summary:', err);
        }
        this.activeReqId = null;
      }

      if (this.isConnected) {
        try {
          this.ibApi.removeAllListeners();
          this.ibApi.disconnect();
          // Wait a bit for clean disconnect
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          Logger.error('Error during disconnect:', err);
        }
        this.isConnected = false;
      }

      this.ibApi = null;
    }

    this.isConnecting = false;
    this.connectionPromise = null;

    Logger.info('✅ Disconnected from IB Gateway');
  }

  // Check if connection is healthy and reconnect if needed
  private static async ensureConnection(userSettings?: { host: string; port: number; client_id: number }): Promise<void> {
    if (!this.isConnected || !this.ibApi) {
      Logger.info('⚠️  Connection not healthy, reconnecting...');
      await this.connect(userSettings);
    } else {
      // Update activity time
      this.lastActivityTime = Date.now();
    }
  }

  // Get account balance from database (accounts.current_balance)
  static async getAccountBalance(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<AccountSummary> {
    Logger.debug('🏦 getAccountBalance called');

    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to get account balance');
    }

    try {
      const { dbGet } = await import('../database/connection.js');
      const account = await dbGet(`
        SELECT current_balance, currency 
        FROM accounts 
        WHERE id = ?
      `, [mainAccountId]);

      if (!account) {
        throw new Error(`Account not found: ${mainAccountId}`);
      }

      Logger.info(`📊 Retrieved account balance from database: ${account.current_balance} ${account.currency || 'USD'}`);

      return {
        balance: account.current_balance || 0,
        currency: account.currency || 'USD',
        netLiquidation: account.current_balance || 0
      };
    } catch (error) {
      Logger.error('❌ Failed to get account balance from database:', error);
      throw error;
    }
  }



  // Force refresh account balance from IB and update database
  static async forceRefreshAccountBalance(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<AccountSummary> {
    Logger.info('🔄 Force refreshing account balance from IB...');
    
    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to refresh account balance');
    }

    // Fetch fresh data from IB
    const freshData = await this.fetchAccountBalanceFresh(userSettings);
    
    // Update database
    try {
      const { dbRun } = await import('../database/connection.js');
      await dbRun(`
        UPDATE accounts 
        SET current_balance = ?, currency = ?, last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [freshData.balance, freshData.currency, mainAccountId]);

      // Update last refresh time
      await this.updateLastRefreshTime(mainAccountId, 'IB_BALANCE');
      
      Logger.info(`💾 Updated account balance in database: ${freshData.balance} ${freshData.currency}`);
    } catch (error) {
      Logger.error('❌ Failed to update account balance in database:', error);
      throw error;
    }

    return freshData;
  }

  // Internal method that actually fetches from IB
  private static async fetchAccountBalanceFresh(userSettings?: { host: string; port: number; client_id: number }): Promise<AccountSummary> {
    // Wait if another request is in progress
    while (this.isRequestInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isRequestInProgress = true;

    try {
      await this.ensureConnection(userSettings);

      if (!this.ibApi) {
        throw new Error('IB API not initialized');
      }

      // Use a fixed request ID to make cancellation reliable
      const reqId = 1;

      // Always cancel any existing subscription first
      try {
        this.ibApi.cancelAccountSummary(reqId);
        // Wait longer for IB Gateway to process the cancellation
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        // Ignore cancellation errors
      }

      this.accountSummaryData.clear();
      this.activeReqId = reqId;

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error('Timeout waiting for account summary'));
          }
        }, 15000);

        const cleanup = () => {
          if (isResolved) return;
          isResolved = true;

          clearTimeout(timeout);

          // Remove event listeners
          this.ibApi!.off(EventName.accountSummary, summaryHandler);
          this.ibApi!.off(EventName.accountSummaryEnd, summaryEndHandler);

          // Cancel the subscription immediately after getting data
          try {
            this.ibApi!.cancelAccountSummary(reqId);
          } catch (err) {
            Logger.error('Error canceling account summary:', err);
          }

          this.activeReqId = null;
          this.isRequestInProgress = false;
        };

        const summaryHandler = (
          _reqId: number,
          _account: string,
          tag: string,
          value: string,
          currency: string
        ) => {
          if (_reqId === reqId) {
            this.accountSummaryData.set(tag, value);
            if (tag === 'Currency') {
              this.accountSummaryData.set('Currency', currency);
            }

            // Log all account summary data to see what's available
            Logger.debug(`Account summary data: ${tag} = ${value} (${currency})`);
          }
        };

        const summaryEndHandler = (_reqId: number) => {
          if (_reqId === reqId && !isResolved) {
            const netLiquidation = parseFloat(this.accountSummaryData.get('NetLiquidation') || '0');
            const currency = this.accountSummaryData.get('Currency') || 'USD';

            cleanup();

            resolve({
              balance: netLiquidation,
              currency: currency,
              netLiquidation: netLiquidation
              // totalCashValue will be handled separately by cash balance method
            });
          }
        };

        this.ibApi!.on(EventName.accountSummary, summaryHandler);
        this.ibApi!.on(EventName.accountSummaryEnd, summaryEndHandler);

        // Request account summary (avoid TotalCashValue to prevent conflicts with cash balance requests)
        this.ibApi!.reqAccountSummary(
          reqId,
          'All',
          'NetLiquidation,Currency'
        );
      });
    } catch (error) {
      this.isRequestInProgress = false;
      throw error;
    }
  }

  /**
   * Map exchange codes to country names, with special handling for specific symbols
   */
  private static deriveCountryFromExchange(exchange?: string, symbol?: string): string {
    // Special case: US Treasury bonds (symbol starts with "US-T")
    if (symbol && symbol.startsWith('US-T')) {
      return 'United States';
    }

    if (!exchange) return '';

    const exchangeCountryMap: Record<string, string> = {
      // US Exchanges
      'NYSE': 'United States',
      'NASDAQ': 'United States',
      'ARCA': 'United States',
      'AMEX': 'United States',
      'BATS': 'United States',
      'IEX': 'United States',
      'ISLAND': 'United States',
      'CBOE': 'United States',
      'PHLX': 'United States',
      'PSE': 'United States',

      // European Exchanges
      'LSE': 'United Kingdom',
      'LSEETF': 'United Kingdom',
      'EURONEXT': 'Europe',
      'FWB': 'Germany',
      'SWB': 'Germany',
      'IBIS': 'Germany',
      'VSE': 'Austria',
      'AEB': 'Netherlands',
      'SBF': 'France',
      'BM': 'Spain',
      'BVME': 'Italy',

      // Canadian Exchanges
      'TSE': 'Canada',  // Toronto Stock Exchange (IB uses TSE for Toronto)
      'TSX': 'Canada',
      'VENTURE': 'Canada',

      // Asian Exchanges
      'SEHK': 'Hong Kong',
      'HKFE': 'Hong Kong',
      'JPX': 'Japan',  // Japan Exchange Group
      'TSEJ': 'Japan', // Tokyo Stock Exchange (if specified as TSEJ)
      'SGX': 'Singapore',
      'KSE': 'South Korea',
      'KRSE': 'South Korea',
      'ASX': 'Australia',
      'NSE': 'India',
      'BSE': 'India',
      'SSE': 'China',
      'SZSE': 'China',

      // Other
      'SIX': 'Switzerland',
      'MOEX': 'Russia',
      'MEXDER': 'Mexico',
      'BVL': 'Brazil',
      'JSE': 'South Africa'
    };

    const upperExchange = exchange.toUpperCase();
    return exchangeCountryMap[upperExchange] || '';
  }

  private static async getContractDetails(conId: number): Promise<any> {
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for contract details'));
      }, 5000);

      const reqId = Math.floor(Math.random() * 10000) + 1000;
      let contractDetailsData: any = null;

      const detailsHandler = (reqId_: number, contractDetails: any) => {
        if (reqId_ === reqId) {
          Logger.debug('📋 Contract details received from IB for symbol:', contractDetails?.contract?.symbol || 'unknown');
          contractDetailsData = contractDetails;
        }
      };

      const endHandler = (reqId_: number) => {
        if (reqId_ === reqId) {
          clearTimeout(timeout);
          this.ibApi!.off(EventName.contractDetails, detailsHandler);
          this.ibApi!.off(EventName.contractDetailsEnd, endHandler);
          resolve(contractDetailsData);
        }
      };

      this.ibApi!.on(EventName.contractDetails, detailsHandler);
      this.ibApi!.on(EventName.contractDetailsEnd, endHandler);

      // Request contract details by conId
      this.ibApi!.reqContractDetails(reqId, { conId });
    });
  }



  private static async getBondMarketData(position: any): Promise<{ closePrice: number; dayChange: number; dayChangePercent: number } | null> {
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    // Skip bonds that have previously failed to avoid repeated timeouts
    if (this.failedBondSymbols.has(position.symbol)) {
      Logger.debug(`Skipping bond market data for ${position.symbol} (previously failed)`);
      return null;
    }

    Logger.debug(`Requesting bond market data for ${position.symbol}...`);

    // If we don't have a contract ID, we can't reliably request market data for bonds
    if (!position.conId || position.conId <= 0) {
      Logger.debug(`No contract ID available for bond ${position.symbol}, cannot request market data`);
      this.failedBondSymbols.add(position.symbol); // Mark as failed
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        Logger.debug(`Timeout getting bond market data for ${position.symbol}`);
        this.failedBondSymbols.add(position.symbol); // Mark as failed to skip in future
        this.ibApi!.removeListener('tickPrice' as any, tickPriceHandler);
        this.ibApi!.removeListener('error' as any, tickPriceErrorHandler);
        this.ibApi!.cancelMktData(reqId);
        resolve(null);
      }, 5000); // Reduced timeout for bonds (was 15000ms)

      const reqId = Math.floor(Math.random() * 10000) + 1000;
      let lastPrice: number | null = null;
      let closePrice: number | null = null;
      let dataReceived = false;
      let lastPriceIsZero = false;

      const tickPriceHandler = (reqId_: number, tickType: number, price: number, attrib: any) => {
        if (reqId_ === reqId) {
          Logger.debug(`Bond tick data for ${position.symbol}: tickType=${tickType}, price=${price}`);

          if (tickType === 4) { // Last Price (current)
            if (price > 0) {
              lastPrice = price;
              Logger.debug(`Got last price for ${position.symbol}: ${price}`);
            } else {
              lastPriceIsZero = true;
              Logger.debug(`Last price reported as 0 for ${position.symbol}, will skip CHG/CHG% calculation`);
            }
          } else if (tickType === 9 && price > 0) { // Close Price (previous day)
            closePrice = price;
            Logger.debug(`Got close price for ${position.symbol}: ${price}`);
          } else if (tickType === 1 && lastPrice === null && price > 0) { // Bid price as fallback for last price
            lastPrice = price;
            Logger.debug(`Using bid price as last price for ${position.symbol}: ${price}`);
          } else if (tickType === 2 && lastPrice === null && price > 0) { // Ask price as fallback for last price
            lastPrice = price;
            Logger.debug(`Using ask price as last price for ${position.symbol}: ${price}`);
          }

          // If we have both prices, decide whether to calculate and return
          if (lastPrice !== null && closePrice !== null && !dataReceived) {
            dataReceived = true;
            clearTimeout(timeout);
            this.ibApi!.removeListener('tickPrice' as any, tickPriceHandler);
            this.ibApi!.cancelMktData(reqId);

            // Do not calculate CHG/CHG% when lastPrice is 0 or non-positive
            if (lastPriceIsZero || lastPrice <= 0) {
              Logger.debug(`Skipping CHG/CHG% for bond ${position.symbol} because lastPrice=0 or non-positive (lastPrice=${lastPrice})`);
              resolve(null);
              return;
            }

            // Also skip if closePrice is non-positive to avoid invalid % calculations
            if (closePrice <= 0) {
              Logger.debug(`Skipping CHG/CHG% for bond ${position.symbol}: closePrice=${closePrice} (non-positive)`);
              resolve(null);
              return;
            }

            // Bond day change calculation: (lastPrice - closePrice) * qty * 10
            // Bonds are quoted as percentage of par value, so multiply by 10 for proper dollar amount
            const dayChange = (lastPrice - closePrice) * position.position * 10;
            const dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;

            Logger.debug(`Calculated bond day change for ${position.symbol}: lastPrice=${lastPrice}, closePrice=${closePrice}, dayChange=${dayChange}, dayChangePercent=${dayChangePercent.toFixed(2)}% (bond formula: qty * 10)`);

            resolve({
              closePrice,
              dayChange,
              dayChangePercent
            });
          }
        }
      };

      const tickPriceErrorHandler = (reqId_: number, errorCode: number, errorString: string) => {
        if (reqId_ === reqId) {
          Logger.debug(`Bond market data error for ${position.symbol}: ${errorCode} - ${errorString}`);
          this.failedBondSymbols.add(position.symbol); // Mark as failed to skip in future
          clearTimeout(timeout);
          this.ibApi!.removeListener('tickPrice' as any, tickPriceHandler);
          this.ibApi!.removeListener('error' as any, tickPriceErrorHandler);
          this.ibApi!.cancelMktData(reqId);
          resolve(null);
        }
      };

      this.ibApi!.on('tickPrice' as any, tickPriceHandler);
      this.ibApi!.on('error' as any, tickPriceErrorHandler);

      try {
        // Use the contract ID directly - this is the most reliable approach for bonds
        const bondContract = {
          conId: position.conId,
          secType: 'BOND' as any,
          exchange: position.exchange || position.primaryExchange || 'SMART',
          currency: position.currency || 'USD'
        };

        Logger.debug(`Using contract ID for bond market data: ${position.conId}`);

        // Set market data type to 3 (delayed) for free bond data
        this.ibApi!.reqMarketDataType(3);

        // Request market data
        this.ibApi!.reqMktData(
          reqId,
          bondContract,
          '', // genericTickList - empty for standard ticks
          false, // snapshot
          false // regulatorySnapshot
        );

        Logger.debug(`Requested market data for bond ${position.symbol} (conId: ${position.conId}) with reqId ${reqId}`);

      } catch (error) {
        Logger.error(`Error requesting bond market data for ${position.symbol}:`, error);
        clearTimeout(timeout);
        this.ibApi!.removeListener('tickPrice' as any, tickPriceHandler);
        this.ibApi!.removeListener('error' as any, tickPriceErrorHandler);
        resolve(null);
      }
    });
  }





  private static async getHistoricalClose(contract: any): Promise<number | undefined> {
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    // Apply throttling before making request
    try {
      await IBRequestThrottler.checkHistoricalDataRequest();
    } catch (error) {
      Logger.warn(`Skipping historical data for ${contract.symbol}: ${error instanceof Error ? error.message : 'throttling error'}`);
      return undefined;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        Logger.debug(`Timeout getting historical data for ${contract.symbol} (${contract.secType})`);
        this.ibApi!.removeAllListeners('historicalData' as any);
        resolve(undefined);
      }, 15000); // Increased timeout to 15 seconds for better reliability

      const reqId = Math.floor(Math.random() * 10000) + 1000;
      const closePrices: number[] = [];
      let isComplete = false;

      const historicalDataHandler = (reqId_: number, time: string, open: number, high: number, low: number, close: number, volume: number, count: number, WAP: number) => {
        if (reqId_ === reqId) {
          // Check if this is the completion signal (time will be 'finished')
          if (time.includes('finished')) {
            if (!isComplete) {
              isComplete = true;
              clearTimeout(timeout);
              this.ibApi!.removeListener('historicalData' as any, historicalDataHandler);

              // Return the first close price (oldest, which should be previous day's close)
              const closePrice = closePrices.length > 0 ? closePrices[0] : undefined;
              Logger.debug(`Final close price for ${contract.symbol} (${contract.secType}): ${closePrice} (from ${closePrices.length} bars)`);
              resolve(closePrice);
            }
          } else if (close > 0) {
            // Collect all close prices
            closePrices.push(close);
            Logger.debug(`Historical bar for ${contract.symbol} (${contract.secType}): date=${time}, close=${close}`);
          }
        }
      };

      this.ibApi!.on('historicalData' as any, historicalDataHandler);

      // Request historical data with appropriate settings for different security types
      try {
        let duration = '2 D';
        let barSize = '1 day' as any;
        let whatToShow = 'TRADES' as any;
        let useRTH = 1; // Regular trading hours

        // Adjust settings based on security type
        if (contract.secType === 'CRYPTO') {
          duration = '2 D';
          barSize = '1 day' as any;
          whatToShow = 'MIDPOINT' as any; // Crypto often uses midpoint
          useRTH = 0; // Crypto trades 24/7
        } else if (contract.secType === 'BOND') {
          duration = '1 W'; // Bonds need more days due to less frequent trading
          barSize = '1 day' as any;
          whatToShow = 'MIDPOINT' as any; // Bonds often work better with midpoint
          useRTH = 1;
        }

        this.ibApi!.reqHistoricalData(
          reqId,
          contract,
          '', // endDateTime - empty means now
          duration,
          barSize,
          whatToShow,
          useRTH,
          1, // formatDate
          false // keepUpToDate
        );
      } catch (error) {
        Logger.error(`Error requesting historical data for ${contract.symbol} (${contract.secType}):`, error);
        clearTimeout(timeout);
        this.ibApi!.removeListener('historicalData' as any, historicalDataHandler);
        resolve(undefined);
      }
    });
  }

  // Get portfolio from database (portfolios table)
  static async getPortfolio(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<PortfolioPosition[]> {
    Logger.debug('📈 getPortfolio called');

    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to get portfolio');
    }

    // Always load from database
    const dbData = await this.loadPortfolioFromDB(mainAccountId);
    Logger.info(`📊 Retrieved ${dbData.length} portfolio positions from database`);
    return dbData;
  }



  // Force refresh portfolio from IB and update database
  static async forceRefreshPortfolio(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<PortfolioPosition[]> {
    Logger.info('📊 Force refreshing portfolio from IB...');
    const refreshStartTime = Date.now();

    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to refresh portfolio');
    }

    // Clear failed bonds cache on manual refresh to retry them
    if (this.failedBondSymbols.size > 0) {
      Logger.info(`📊 Clearing ${this.failedBondSymbols.size} failed bond symbols for retry`);
      this.failedBondSymbols.clear();
    }

    // Fetch fresh data from IB (this will automatically save to database)
    const freshData = await this.fetchPortfolioFresh(userSettings);
    
    // Update last refresh time
    await this.updateLastRefreshTime(mainAccountId, 'IB_PORTFOLIO');

    const refreshEndTime = Date.now();
    const totalDuration = refreshEndTime - refreshStartTime;
    Logger.info(`📊 Portfolio refresh completed in ${totalDuration}ms (${freshData.length} positions)`);

    return freshData;
  }

  // Internal method that actually fetches from IB
  private static async fetchPortfolioFresh(userSettings?: { host: string; port: number; client_id: number }): Promise<PortfolioPosition[]> {
    // Wait if another request is in progress
    while (this.isPortfolioRequestInProgress || this.isRequestInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Add a small delay if we just finished an account summary request
    if (this.activeReqId !== null) {
      Logger.debug('Waiting for account summary to fully complete...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isPortfolioRequestInProgress = true;

    try {
      await this.ensureConnection(userSettings);

      if (!this.ibApi) {
        throw new Error('IB API not initialized');
      }

      this.portfolioPositions = [];
      this.cashBalances = [];
      const mainAccountId = (userSettings as any)?.target_account_id ?? null;

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error('Timeout waiting for portfolio data'));
          }
        }, 30000);

        const cleanup = () => {
          if (isResolved) return;
          isResolved = true;

          clearTimeout(timeout);

          // Remove event listeners
          this.ibApi!.off(EventName.updatePortfolio, portfolioHandler);
          this.ibApi!.off(EventName.accountDownloadEnd, downloadEndHandler);

          // Unsubscribe from account updates
          try {
            this.ibApi!.reqAccountUpdates(false, '');
            Logger.debug('Unsubscribed from account updates');
          } catch (err) {
            Logger.error('Error unsubscribing from account updates:', err);
          }

          this.isPortfolioRequestInProgress = false;
        };

        const portfolioHandler = (
          contract: any,
          position: number,
          marketPrice: number,
          marketValue: number,
          averageCost?: number,
          unrealizedPNL?: number,
          realizedPNL?: number,
          accountName?: string
        ) => {
          // Log all contracts to debug cash positions
          Logger.debug('📊 Portfolio contract received:', contract.symbol, contract.secType);

          // Handle cash positions separately
          if (contract.secType === 'CASH') {
            Logger.debug('💰 Found cash position:', contract.symbol || contract.currency || 'USD', 'amount:', position);
            this.cashBalances.push({
              currency: contract.symbol || contract.currency || 'USD',
              amount: position,
              marketValueHKD: marketValue
            });
            return;
          }

          // Log contract details to see what's available
          Logger.debug('📊 Processing contract:', contract.symbol, contract.secType);

          this.portfolioPositions.push({
            symbol: contract.symbol || '',
            secType: contract.secType || '',
            currency: contract.currency || '',
            position: position,
            averageCost: averageCost || 0,
            marketPrice: marketPrice,
            marketValue: marketValue,
            unrealizedPNL: unrealizedPNL || 0,
            realizedPNL: realizedPNL || 0,
            exchange: contract.exchange || '',
            primaryExchange: contract.primaryExch || '',
            conId: contract.conId || 0
          });
        };

        const downloadEndHandler = async (accountName: string) => {
          if (!isResolved) {
            // Stop the initial wait timer now that account data download ended
            clearTimeout(timeout);

            Logger.info(`📊 Starting enrichment of ${this.portfolioPositions.length} positions...`);
            const enrichmentStartTime = Date.now();

            // Fetch contract details and market data for each position
            // Process sequentially instead of parallel to avoid overwhelming IB Gateway
            const enrichedPositions: PortfolioPosition[] = [];
            for (const position of this.portfolioPositions) {
              try {
                let enrichedPosition = { ...position };

                  if (position.conId && ['STK', 'CRYPTO', 'BOND'].includes(position.secType)) {
                    Logger.debug(`Processing ${position.symbol} (${position.secType}) for day change data...`);

                    // Handle bonds with market data approach directly
                    if (position.secType === 'BOND') {
                      Logger.debug(`Using market data approach for bond ${position.symbol}...`);

                      // Get contract details to extract additional info for bonds
                      const bondDetails = await this.getContractDetails(position.conId);

                      Logger.debug(`Bond ${position.symbol} contract details:`, {
                        marketName: bondDetails?.marketName,
                        longName: bondDetails?.longName,
                        exchange: bondDetails?.contract?.exchange,
                        primaryExch: bondDetails?.contract?.primaryExch
                      });

                      // Set basic bond info - derive country from market name or exchange
                      const country = this.deriveCountryFromExchange(
                        bondDetails?.contract?.primaryExch || bondDetails?.contract?.exchange || position.primaryExchange || position.exchange,
                        position.symbol
                      );

                      enrichedPosition = {
                        ...enrichedPosition,
                        industry: 'Fixed Income',
                        category: 'Bond',
                        country: country || bondDetails?.marketName || ''
                      };

                      // Get bond data using market data ticks
                      const bondMarketData = await this.getBondMarketData(position);
                      if (bondMarketData && bondMarketData.closePrice > 0) {
                        enrichedPosition.closePrice = bondMarketData.closePrice;
                        enrichedPosition.dayChange = bondMarketData.dayChange;
                        enrichedPosition.dayChangePercent = bondMarketData.dayChangePercent;
                        Logger.debug(`Got bond market data for ${position.symbol}: closePrice=${bondMarketData.closePrice}, dayChange=${bondMarketData.dayChange}, dayChangePercent=${bondMarketData.dayChangePercent.toFixed(2)}%`);
                      } else {
                        Logger.debug(`Bond market data failed for ${position.symbol}`);
                      }
                    } else {
                      // Handle stocks and crypto with contract details and historical data
                      const details = await this.getContractDetails(position.conId);
                      if (details) {
                        Logger.debug(`Got contract details for ${position.symbol} (${position.secType}):`, {
                          marketName: details.marketName,
                          longName: details.longName,
                          exchange: details.contract?.exchange,
                          primaryExch: details.contract?.primaryExch,
                          industry: details.industry,
                          category: details.category
                        });

                        // Derive country from exchange
                        const country = this.deriveCountryFromExchange(
                          details.contract?.primaryExch || details.contract?.exchange || position.primaryExchange || position.exchange,
                          position.symbol
                        );

                        // Set industry/category for stocks and crypto
                        if (position.secType === 'STK') {
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: details.industry || '',
                            category: details.category || '',
                            country: country || details.marketName || ''
                          };
                        } else if (position.secType === 'CRYPTO') {
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: 'Cryptocurrency',
                            category: 'Digital Asset',
                            country: country || details.marketName || ''
                          };
                        }

                        // Get historical close price
                        Logger.debug(`Requesting historical data for ${position.symbol} (${position.secType})...`);
                        let closePrice = await this.getHistoricalClose(details.contract);
                        Logger.debug(`Historical data result for ${position.symbol} (${position.secType}): closePrice=${closePrice}`);



                        if (closePrice && closePrice > 0) {
                          enrichedPosition.closePrice = closePrice;

                          // Calculate day change: (marketPrice - closePrice) * qty
                          const dayChange = (position.marketPrice - closePrice) * position.position;
                          // Calculate day change percent: ((marketPrice - closePrice) / closePrice) * 100
                          const dayChangePercent = ((position.marketPrice - closePrice) / closePrice) * 100;

                          enrichedPosition.dayChange = dayChange;
                          enrichedPosition.dayChangePercent = dayChangePercent;

                          Logger.debug(`${position.symbol} (${position.secType}): closePrice=${closePrice}, marketPrice=${position.marketPrice}, dayChange=${dayChange}, dayChangePercent=${dayChangePercent.toFixed(2)}%`);
                        } else {
                          Logger.debug(`${position.symbol} (${position.secType}): Could not get historical close price`);
                        }
                      } else {
                        Logger.debug(`Failed to get contract details for ${position.symbol} (${position.secType})`);

                        // For crypto without contract details, set basic info but no day change data
                        if (position.secType === 'CRYPTO') {
                          Logger.debug(`Contract details failed for crypto ${position.symbol}, cannot get day change data`);

                          // Try to derive country from exchange even without contract details
                          const country = this.deriveCountryFromExchange(position.primaryExchange || position.exchange, position.symbol);

                          // Set basic crypto info without contract details
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: 'Cryptocurrency',
                            category: 'Digital Asset',
                            country: country || ''
                          };
                        }
                      }
                    }
                  }

                enrichedPositions.push(enrichedPosition);
              } catch (error) {
                Logger.error(`Failed to get details for ${position.symbol}:`, error);
                enrichedPositions.push(position);
              }
            }

            const enrichmentEndTime = Date.now();
            const enrichmentDuration = enrichmentEndTime - enrichmentStartTime;
            Logger.info(`📊 Position enrichment completed in ${enrichmentDuration}ms`);

            // Persist to DB if we have a target account to associate with
            try {
              if (typeof (mainAccountId) === 'number') {
                const dbStartTime = Date.now();
                await this.savePortfolioToDB(mainAccountId, enrichedPositions);
                const dbEndTime = Date.now();
                const dbDuration = dbEndTime - dbStartTime;
                Logger.info(`📊 Database persistence completed in ${dbDuration}ms`);
              } else {
                Logger.warn('⚠️ No target_account_id provided; skipping DB persist for IB portfolio');
              }
            } catch (e) {
              Logger.error('❌ Error persisting IB portfolio to DB:', e);
            }

            Logger.info(`💰 Captured ${this.cashBalances.length} cash positions:`, this.cashBalances);
            
            // Save cash balances to database
            if (typeof (mainAccountId) === 'number') {
              const enrichedCashBalances = await this.enrichCashBalancesWithUSD(this.cashBalances);
              await this.saveCashBalancesToDB(mainAccountId, enrichedCashBalances);
            }

            cleanup();
            resolve(enrichedPositions);
          }
        };

        this.ibApi!.on(EventName.updatePortfolio, portfolioHandler);
        this.ibApi!.on(EventName.accountDownloadEnd, downloadEndHandler);

        // Request account updates to get portfolio
        this.ibApi!.reqAccountUpdates(true, '');
      });
    } catch (error) {
      this.isPortfolioRequestInProgress = false;
      throw error;
    }
  }

  // Combined method for frontend (returns data from database)
  static async getAccountData(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
    const [balance, portfolio] = await Promise.all([
      this.getAccountBalance(userSettings),
      this.getPortfolio(userSettings)
    ]);

    return { balance, portfolio };
  }

  // Force refresh balance, portfolio, and cash balances from IB and update database
  static async forceRefreshAll(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[]; cashBalances: CashBalance[] }> {
    Logger.info('🔄 Force refreshing all account data from IB...');

    const [balance, portfolio, cashBalances] = await Promise.all([
      this.forceRefreshAccountBalance(userSettings),
      this.forceRefreshPortfolio(userSettings),
      this.forceRefreshCashBalances(userSettings)
    ]);

    return { balance, portfolio, cashBalances };
  }

  // Get last refresh status from database
  static async getRefreshStatus(mainAccountId: number): Promise<{ balance: string; portfolio: string; cash: string }> {
    const [balanceTime, portfolioTime, cashTime] = await Promise.all([
      this.getLastRefreshTime(mainAccountId, 'IB_BALANCE'),
      this.getLastRefreshTime(mainAccountId, 'IB_PORTFOLIO'),
      this.getLastRefreshTime(mainAccountId, 'IB_CASH')
    ]);

    const formatTime = (time: Date | null): string => {
      if (!time) return 'Never refreshed';
      const ageMs = Date.now() - time.getTime();
      const ageMinutes = Math.round(ageMs / 1000 / 60);
      return `${ageMinutes} minutes ago`;
    };

    return {
      balance: formatTime(balanceTime),
      portfolio: formatTime(portfolioTime),
      cash: formatTime(cashTime)
    };
  }

  // Get balance timestamp from database
  static async getBalanceTimestamp(mainAccountId: number): Promise<number | null> {
    const time = await this.getLastRefreshTime(mainAccountId, 'IB_BALANCE');
    return time ? time.getTime() : null;
  }

  // Get portfolio timestamp from database
  static async getPortfolioTimestamp(mainAccountId: number): Promise<number | null> {
    const time = await this.getLastRefreshTime(mainAccountId, 'IB_PORTFOLIO');
    return time ? time.getTime() : null;
  }

  // Get cash balances from database (cash_balances table)
  static async getCashBalances(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<CashBalance[]> {
    Logger.debug('💰 getCashBalances called');

    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to get cash balances');
    }

    // Always load from database
    const dbData = await this.loadCashBalancesFromDB(mainAccountId);
    Logger.info(`💰 Retrieved ${dbData.length} cash balances from database`);
    return dbData;
  }

  // Force refresh cash balances from IB and update database
  static async forceRefreshCashBalances(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<CashBalance[]> {
    Logger.info('💰 Force refreshing cash balances from IB...');

    const mainAccountId = userSettings.target_account_id;
    if (!mainAccountId) {
      throw new Error('target_account_id is required to refresh cash balances');
    }

    // Fetch fresh data from IB
    const freshData = await this.fetchCashBalancesUsingAccountSummary(userSettings);

    // Calculate USD values and save to database
    const enrichedData = await this.enrichCashBalancesWithUSD(freshData);
    await this.saveCashBalancesToDB(mainAccountId, enrichedData);

    // Update last refresh time
    await this.updateLastRefreshTime(mainAccountId, 'IB_CASH');

    Logger.info(`💰 Refreshed ${enrichedData.length} cash balances from IB`);
    return enrichedData;
  }

  // Enrich cash balances with USD values using exchange rates
  private static async enrichCashBalancesWithUSD(cashBalances: CashBalance[]): Promise<CashBalance[]> {
    const enrichedBalances: CashBalance[] = [];

    for (const cash of cashBalances) {
      let marketValueUSD = cash.marketValueHKD;

      if (cash.currency !== 'USD') {
        try {
          // Get exchange rate to USD
          const { ExchangeRateService } = await import('./exchangeRateService.js');
          const rate = await ExchangeRateService.getExchangeRate(cash.currency, 'USD');
          marketValueUSD = cash.marketValueHKD * rate;
        } catch (error) {
          Logger.error(`Failed to get USD rate for ${cash.currency}:`, error);
          marketValueUSD = cash.marketValueHKD; // Fallback to original value
        }
      }

      enrichedBalances.push({
        ...cash,
        marketValueUSD
      });
    }

    return enrichedBalances;
  }

  // Get cash timestamp from database
  static async getCashTimestamp(mainAccountId: number): Promise<number | null> {
    const time = await this.getLastRefreshTime(mainAccountId, 'IB_CASH');
    return time ? time.getTime() : null;
  }

  // Save cash balances to database
  private static async saveCashBalancesToDB(mainAccountId: number, cashBalances: CashBalance[]): Promise<void> {
    try {
      const { dbRun } = await import('../database/connection.js');

      Logger.debug(`💾 Saving ${cashBalances.length} cash balances to DB for account ${mainAccountId}...`);

      // Delete existing cash balances for this account
      await dbRun('DELETE FROM cash_balances WHERE main_account_id = ? AND source = ?', [mainAccountId, 'IB']);

      if (cashBalances.length === 0) {
        Logger.debug('💾 No cash balances to save');
        return;
      }

      // Insert new cash balances
      for (const cash of cashBalances) {
        await dbRun(`
          INSERT INTO cash_balances (
            main_account_id, currency, amount, market_value_hkd, market_value_usd, source, 
            last_updated, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          mainAccountId,
          cash.currency,
          cash.amount,
          cash.marketValueHKD,
          cash.marketValueUSD || null,
          'IB'
        ]);
      }

      Logger.debug(`💾 Saved ${cashBalances.length} cash balances to DB`);
    } catch (error) {
      Logger.error('❌ Failed to save cash balances to DB:', error);
    }
  }

  // Load cash balances from database
  private static async loadCashBalancesFromDB(mainAccountId?: number | null): Promise<CashBalance[]> {
    try {
      const { dbAll } = await import('../database/connection.js');

      let rows: any[];
      if (mainAccountId != null) {
        rows = await dbAll(
          'SELECT * FROM cash_balances WHERE main_account_id = ? AND source = ? ORDER BY currency',
          [mainAccountId, 'IB']
        );
      } else {
        rows = await dbAll(
          'SELECT * FROM cash_balances WHERE source = ? ORDER BY main_account_id, currency',
          ['IB']
        );
      }

      const cashBalances: CashBalance[] = rows.map((row: any) => ({
        currency: row.currency,
        amount: row.amount,
        marketValueHKD: row.market_value_hkd,
        marketValueUSD: row.market_value_usd
      }));

      Logger.debug(`📥 Loaded ${cashBalances.length} cash balances from DB${mainAccountId != null ? ' for account ' + mainAccountId : ''}`);
      return cashBalances;
    } catch (error) {
      Logger.error('❌ Failed to load cash balances from DB:', error);
      return [];
    }
  }



  // Method using account summary to get cash balances by currency (based on working example)
  private static async fetchCashBalancesUsingAccountSummary(userSettings?: { host: string; port: number; client_id: number }): Promise<CashBalance[]> {
    Logger.debug('💰 Fetching cash balances using TotalCashValue by currency...');

    // Wait if another request is in progress
    while (this.isRequestInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Add a small delay to ensure previous requests are fully processed
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isRequestInProgress = true;

    try {
      await this.ensureConnection(userSettings);

      if (!this.ibApi) {
        throw new Error('IB API not initialized');
      }

      const reqId = 3; // Use different ID
      const balances: Record<string, number> = {}; // Store balances by currency like in the example
      let realCurrency = 'USD'; // Default to USD, will be updated from RealCurrency tag

      // Always cancel any existing subscription first
      try {
        this.ibApi.cancelAccountSummary(reqId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        // Ignore cancellation errors
      }

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error('Timeout waiting for TotalCashValue data'));
          }
        }, 15000);

        const cleanup = () => {
          if (isResolved) return;
          isResolved = true;

          clearTimeout(timeout);

          // Remove event listeners
          this.ibApi!.off(EventName.accountSummary, summaryHandler);
          this.ibApi!.off(EventName.accountSummaryEnd, summaryEndHandler);

          // Cancel the subscription
          try {
            this.ibApi!.cancelAccountSummary(reqId);
          } catch (err) {
            Logger.error('Error canceling account summary:', err);
          }

          this.isRequestInProgress = false;
        };

        const summaryHandler = (
          _reqId: number,
          _account: string,
          tag: string,
          value: string,
          currency: string
        ) => {
          if (_reqId === reqId) {
            // Use only CashBalance to avoid duplication, and skip BASE (which is the total)
            if (tag === 'CashBalance' && currency !== 'BASE') {
              const amount = parseFloat(value);

              if (amount !== 0) { // Only store non-zero balances
                balances[currency] = amount;
                Logger.debug(`💰 Cash balance: ${currency} = ${amount}`);
              }
            } else if (tag === 'RealCurrency') {
              realCurrency = value;
            }
          }
        };

        const summaryEndHandler = (_reqId: number) => {
          if (_reqId === reqId && !isResolved) {
            Logger.debug(`💰 Found ${Object.keys(balances).length} cash balances`);

            // Convert to CashBalance array, handling BASE currency conversion
            const cashBalances: CashBalance[] = [];
            for (const [currency, amount] of Object.entries(balances)) {
              // Convert BASE to real currency, or use currency as-is
              const actualCurrency = currency === 'BASE' ? realCurrency : currency;

              cashBalances.push({
                currency: actualCurrency,
                amount: amount,
                marketValueHKD: amount // For cash, market value equals amount
              });
            }


            cleanup();
            resolve(cashBalances);
          }
        };

        this.ibApi!.on(EventName.accountSummary, summaryHandler);
        this.ibApi!.on(EventName.accountSummaryEnd, summaryEndHandler);

        // Request account summary with $LEDGER:ALL to get all currency data (like the working example)
        this.ibApi!.reqAccountSummary(
          reqId,
          'All',
          '$LEDGER:ALL'
        );
      });
    } catch (error) {
      this.isRequestInProgress = false;
      throw error;
    }
  }

  // Internal method to fetch cash balances using account updates (better for multi-currency)
  private static async fetchCashBalancesFresh(userSettings?: { host: string; port: number; client_id: number }): Promise<CashBalance[]> {
    Logger.debug('💰 Fetching cash balances using account updates...');

    // Wait if another request is in progress
    while (this.isRequestInProgress || this.isPortfolioRequestInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Add a small delay to ensure previous requests are fully processed
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isPortfolioRequestInProgress = true;

    try {
      await this.ensureConnection(userSettings);

      if (!this.ibApi) {
        throw new Error('IB API not initialized');
      }

      const cashBalances: CashBalance[] = [];

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error('Timeout waiting for cash balance data'));
          }
        }, 20000);

        const cleanup = () => {
          if (isResolved) return;
          isResolved = true;

          clearTimeout(timeout);

          // Remove event listeners
          this.ibApi!.off(EventName.updatePortfolio, portfolioHandler);
          this.ibApi!.off(EventName.updateAccountValue, accountValueHandler);
          this.ibApi!.off(EventName.accountDownloadEnd, downloadEndHandler);

          // Unsubscribe from account updates
          try {
            this.ibApi!.reqAccountUpdates(false, '');
            Logger.debug('💰 Unsubscribed from account updates for cash balances');
          } catch (err) {
            Logger.error('Error unsubscribing from account updates:', err);
          }

          this.isPortfolioRequestInProgress = false;
        };

        // Handle portfolio updates (including cash positions)
        const portfolioHandler = (
          contract: any,
          position: number,
          marketPrice: number,
          marketValue: number,
          averageCost?: number,
          unrealizedPNL?: number,
          realizedPNL?: number,
          accountName?: string
        ) => {
          // Only capture cash positions
          if (contract.secType === 'CASH') {
            Logger.debug('💰 Found cash position:', contract.symbol, contract.currency);

            cashBalances.push({
              currency: contract.symbol || contract.currency || 'USD',
              amount: position,
              marketValueHKD: marketValue
            });
          }
        };

        // Handle account value updates (alternative way to get cash by currency)
        const accountValueHandler = (
          key: string,
          value: string,
          currency: string,
          accountName: string
        ) => {
          // Look for cash balance keys
          if (key === 'CashBalance' || key === 'SettledCash') {
            const amount = parseFloat(value);
            if (amount !== 0) {
              Logger.debug(`💰 Found cash via account value: ${key} = ${amount} ${currency}`);

              // Check if we already have this currency from portfolio
              const existingIndex = cashBalances.findIndex(cb => cb.currency === currency);
              if (existingIndex === -1) {
                cashBalances.push({
                  currency: currency,
                  amount: amount,
                  marketValueHKD: amount
                });
              } else {
                // Update existing entry if this gives us more accurate data
                const existing = cashBalances[existingIndex];
                if (existing) {
                  existing.amount = amount;
                  existing.marketValueHKD = amount;
                }
              }
            }
          }
        };

        const downloadEndHandler = async (accountName: string) => {
          if (!isResolved) {
            Logger.debug(`💰 Account download ended, found ${cashBalances.length} cash positions:`, cashBalances);
            cleanup();
            resolve(cashBalances);
          }
        };

        this.ibApi!.on(EventName.updatePortfolio, portfolioHandler);
        this.ibApi!.on(EventName.updateAccountValue, accountValueHandler);
        this.ibApi!.on(EventName.accountDownloadEnd, downloadEndHandler);

        // Request account updates to get both portfolio and account values
        this.ibApi!.reqAccountUpdates(true, '');
        Logger.debug('💰 Requested account updates for cash balances');
      });
    } catch (error) {
      this.isPortfolioRequestInProgress = false;
      throw error;
    }
  }

  // Get database statistics for reporting
  static async getDataStats(mainAccountId: number): Promise<{
    balance: { hasData: boolean; timestamp: number | null; ageMinutes: number | null };
    portfolio: { hasData: boolean; timestamp: number | null; ageMinutes: number | null; count: number };
    cash: { hasData: boolean; timestamp: number | null; ageMinutes: number | null; count: number };
  }> {
    const now = Date.now();

    const [balanceTime, portfolioTime, cashTime] = await Promise.all([
      this.getLastRefreshTime(mainAccountId, 'IB_BALANCE'),
      this.getLastRefreshTime(mainAccountId, 'IB_PORTFOLIO'),
      this.getLastRefreshTime(mainAccountId, 'IB_CASH')
    ]);

    // Get data counts
    const { dbGet, dbAll } = await import('../database/connection.js');
    const [accountData, portfolioData, cashData] = await Promise.all([
      dbGet('SELECT current_balance FROM accounts WHERE id = ?', [mainAccountId]),
      dbAll('SELECT COUNT(*) as count FROM portfolios WHERE main_account_id = ? AND source = ?', [mainAccountId, 'IB']),
      dbAll('SELECT COUNT(*) as count FROM cash_balances WHERE main_account_id = ? AND source = ?', [mainAccountId, 'IB'])
    ]);

    return {
      balance: {
        hasData: !!accountData,
        timestamp: balanceTime ? balanceTime.getTime() : null,
        ageMinutes: balanceTime ? Math.round((now - balanceTime.getTime()) / 1000 / 60) : null
      },
      portfolio: {
        hasData: portfolioData.length > 0 && portfolioData[0].count > 0,
        timestamp: portfolioTime ? portfolioTime.getTime() : null,
        ageMinutes: portfolioTime ? Math.round((now - portfolioTime.getTime()) / 1000 / 60) : null,
        count: portfolioData.length > 0 ? portfolioData[0].count : 0
      },
      cash: {
        hasData: cashData.length > 0 && cashData[0].count > 0,
        timestamp: cashTime ? cashTime.getTime() : null,
        ageMinutes: cashTime ? Math.round((now - cashTime.getTime()) / 1000 / 60) : null,
        count: cashData.length > 0 ? cashData[0].count : 0
      }
    };
  }
}