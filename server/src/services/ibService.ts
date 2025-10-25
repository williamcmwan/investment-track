import { IBApi, EventName, ErrorCode } from '@stoqey/ib';
import * as fs from 'fs';
import * as path from 'path';
import { LastUpdateService } from './lastUpdateService.js';

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

interface CachedData<T> {
  data: T;
  timestamp: number;
  isRefreshing?: boolean;
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
  private static isPortfolioRequestInProgress = false;
  private static keepAliveInterval: NodeJS.Timeout | null = null;
  private static lastActivityTime = 0;
  private static readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes idle timeout
  
  // Track failed bond market data requests to avoid repeated timeouts
  private static failedBondSymbols: Set<string> = new Set();

  // Cache storage (in-memory for fast access)
  private static balanceCache: CachedData<AccountSummary> | null = null;
  private static portfolioCache: CachedData<PortfolioPosition[]> | null = null;

  // Cache auto-refresh times (in milliseconds)
  private static readonly AUTO_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes - auto refresh if no manual refresh
  private static readonly BALANCE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - for balance freshness check
  private static readonly PORTFOLIO_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes - for portfolio freshness check

  // Cache file paths
  private static readonly CACHE_DIR = path.join(process.cwd(), 'cache');
  private static readonly BALANCE_CACHE_FILE = path.join(IBService.CACHE_DIR, 'balance.json');
  private static readonly PORTFOLIO_CACHE_FILE = path.join(IBService.CACHE_DIR, 'portfolio.json');

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
      console.log('🚀 Initializing IB Service...');
      // Don't connect immediately, let it connect on first request
      // This avoids connection issues if IB Gateway isn't running at startup
      console.log('✅ IB Service initialized (connection will be established on first request)');
    } catch (error) {
      console.error('❌ Failed to initialize IB Service:', error);
    }
  }

  // Graceful shutdown
  static async shutdown(): Promise<void> {
    console.log('🛑 Shutting down IB Service...');
    await this.disconnect();
    console.log('✅ IB Service shutdown complete');
  }

  // Cache management methods
  private static ensureCacheDir(): void {
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  private static loadCacheFromFile<T>(filePath: string): CachedData<T> | null {
    try {
      console.log(`🔍 Checking cache file: ${filePath}`);
      if (fs.existsSync(filePath)) {
        console.log(`✅ Cache file exists, loading...`);
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data) as CachedData<T>;
        console.log(`📄 Loaded cache with timestamp: ${parsed.timestamp}, age: ${Date.now() - parsed.timestamp}ms`);
        return parsed;
      } else {
        console.log(`❌ Cache file does not exist: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to load cache from ${filePath}:`, error);
    }
    return null;
  }

  private static saveCacheToFile<T>(filePath: string, cache: CachedData<T>): void {
    try {
      console.log(`💾 Saving cache to file: ${filePath}`);
      this.ensureCacheDir();
      fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
      console.log(`✅ Cache saved successfully to ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to save cache to ${filePath}:`, error);
    }
  }

  private static isCacheValid<T>(cache: CachedData<T> | null, duration: number): boolean {
    return cache !== null && (Date.now() - cache.timestamp) < duration;
  }

  private static shouldAutoRefresh<T>(cache: CachedData<T> | null): boolean {
    if (!cache) return true; // No cache, should refresh
    const cacheAge = Date.now() - cache.timestamp;
    return cacheAge > this.AUTO_REFRESH_INTERVAL && !cache.isRefreshing;
  }

  private static async refreshBalanceBackground(userSettings: { host: string; port: number; client_id: number }): Promise<void> {
    try {
      console.log('🔄 Starting background balance refresh...');
      if (this.balanceCache) {
        this.balanceCache.isRefreshing = true;
      }

      const freshBalance = await this.fetchAccountBalanceFresh(userSettings);
      this.setCachedBalance(freshBalance);
      LastUpdateService.updateIBPortfolioTime();
      console.log('✅ Background balance refresh completed');
    } catch (error) {
      console.error('❌ Background balance refresh failed:', error);
    } finally {
      if (this.balanceCache) {
        this.balanceCache.isRefreshing = false;
      }
    }
  }

  private static async refreshPortfolioBackground(userSettings: { host: string; port: number; client_id: number }): Promise<void> {
    try {
      console.log('🔄 Starting background portfolio refresh...');
      if (this.portfolioCache) {
        this.portfolioCache.isRefreshing = true;
      }

      const freshPortfolio = await this.fetchPortfolioFresh(userSettings);
      this.setCachedPortfolio(freshPortfolio);
      LastUpdateService.updateIBPortfolioTime();
      console.log('✅ Background portfolio refresh completed');
    } catch (error) {
      console.error('❌ Background portfolio refresh failed:', error);
    } finally {
      if (this.portfolioCache) {
        this.portfolioCache.isRefreshing = false;
      }
    }
  }

  private static getCachedBalance(): AccountSummary | null {
    console.log('getCachedBalance called');

    // Load from file if not in memory
    if (!this.balanceCache) {
      console.log('Memory cache empty, trying to load from file:', this.BALANCE_CACHE_FILE);
      this.balanceCache = this.loadCacheFromFile<AccountSummary>(this.BALANCE_CACHE_FILE);
    }

    // Always return cached data if available (never remove cache)
    if (this.balanceCache) {
      const cacheAge = Date.now() - this.balanceCache.timestamp;
      console.log(`Returning cached balance (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      return this.balanceCache.data;
    }

    console.log('No cached balance found');
    return null;
  }

  private static setCachedBalance(data: AccountSummary): void {
    this.balanceCache = {
      data,
      timestamp: Date.now(),
      isRefreshing: false
    };
    // Save to file for persistence
    this.saveCacheToFile(this.BALANCE_CACHE_FILE, this.balanceCache);
    console.log('Account balance cached in memory and file');
  }

  private static getCachedPortfolio(): PortfolioPosition[] | null {
    console.log('getCachedPortfolio called');

    // Always return cached data if available (never remove cache)
    if (this.portfolioCache) {
      const cacheAge = Date.now() - this.portfolioCache.timestamp;
      console.log(`Returning cached portfolio (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      return this.portfolioCache.data;
    }

    console.log('No cached portfolio found in memory');
    return null;
  }

  private static setCachedPortfolio(data: PortfolioPosition[]): void {
    this.portfolioCache = {
      data,
      timestamp: Date.now(),
      isRefreshing: false
    };
    console.log('Portfolio cached in memory');
  }

  // Persist IB portfolio to DB (source = 'IB') for a given main account
  private static async savePortfolioToDB(mainAccountId: number, positions: PortfolioPosition[]): Promise<void> {
    try {
      const { dbRun } = await import('../database/connection.js');
      
      console.log(`💾 Starting batch save of ${positions.length} IB portfolio positions to DB...`);
      const startTime = Date.now();
      
      // Replace existing IB records for this account
      await dbRun('DELETE FROM portfolios WHERE source = ? AND main_account_id = ?', ['IB', mainAccountId]);

      if (positions.length === 0) {
        console.log('💾 No positions to save');
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
      console.log(`💾 Batch saved ${positions.length} IB portfolio rows to DB for account ${mainAccountId} in ${duration}ms`);
      
    } catch (e) {
      console.error('❌ Failed to save IB portfolio to DB:', e);
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
      console.log(`📥 Loaded ${positions.length} IB portfolio rows from DB${mainAccountId != null ? ' for account ' + mainAccountId : ''}`);
      return positions;
    } catch (e) {
      console.error('❌ Failed to load IB portfolio from DB:', e);
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
      console.log('✅ Already connected to IB Gateway, reusing persistent connection');
      this.lastActivityTime = Date.now();
      return;
    }

    // If already connecting, wait for that connection to complete
    if (this.isConnecting && this.connectionPromise) {
      console.log('⏳ Connection in progress, waiting...');
      return this.connectionPromise;
    }

    // Enforce delay between connection attempts to avoid rate limiting
    const timeSinceLastAttempt = Date.now() - this.lastConnectionAttempt;
    if (timeSinceLastAttempt < this.connectionRetryDelay) {
      const waitTime = this.connectionRetryDelay - timeSinceLastAttempt;
      console.log(`⏱️  Waiting ${waitTime}ms before reconnection attempt...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastConnectionAttempt = Date.now();
    this.isConnecting = true;

    // If there's an existing API instance but not connected, clean it up
    if (this.ibApi && !this.isConnected) {
      try {
        console.log('🧹 Cleaning up disconnected IB API instance...');
        this.ibApi.removeAllListeners();
        this.ibApi.disconnect();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error('Error cleaning up:', err);
      }
      this.ibApi = null;
    }

    const settings = this.getUserConnectionSettings(userSettings);
    console.log(`🔌 Connecting to IB Gateway at ${settings.host}:${settings.port} with client ID ${settings.clientId}...`);

    this.connectionPromise = new Promise((resolve, reject) => {
      this.ibApi = new IBApi({
        host: settings.host,
        port: settings.port,
        clientId: settings.clientId
      });

      const timeout = setTimeout(() => {
        console.error('❌ Connection timeout - cleaning up...');
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
        console.log('✅ Successfully connected to IB Gateway - maintaining persistent connection');

        // Start keep-alive mechanism
        this.startKeepAlive();

        resolve();
      });

      this.ibApi!.on(EventName.disconnected, () => {
        console.log('⚠️  Disconnected from IB Gateway');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopKeepAlive();
      });

      this.ibApi!.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
        console.error(`❌ IB API Error [${code}]:`, err.message);

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
        console.error('❌ Error calling connect():', err);
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

    console.log('🔄 Starting keep-alive mechanism');

    // Check connection health every 5 minutes
    this.keepAliveInterval = setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;

      if (idleTime > this.IDLE_TIMEOUT) {
        console.log(`⏰ Connection idle for ${Math.round(idleTime / 60000)} minutes, disconnecting...`);
        this.disconnect();
      } else {
        console.log(`💓 Connection alive, idle for ${Math.round(idleTime / 60000)} minutes`);
      }
    }, 5 * 60 * 1000);
  }

  // Stop keep-alive mechanism
  private static stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('🛑 Stopped keep-alive mechanism');
    }
  }

  static async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from IB Gateway...');

    this.stopKeepAlive();

    if (this.ibApi) {
      // Cancel any active account summary request
      if (this.activeReqId !== null) {
        try {
          this.ibApi.cancelAccountSummary(this.activeReqId);
        } catch (err) {
          console.error('Error canceling account summary:', err);
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
          console.error('Error during disconnect:', err);
        }
        this.isConnected = false;
      }

      this.ibApi = null;
    }

    this.isConnecting = false;
    this.connectionPromise = null;

    console.log('✅ Disconnected from IB Gateway');
  }

  // Check if connection is healthy and reconnect if needed
  private static async ensureConnection(userSettings?: { host: string; port: number; client_id: number }): Promise<void> {
    if (!this.isConnected || !this.ibApi) {
      console.log('⚠️  Connection not healthy, reconnecting...');
      await this.connect(userSettings);
    } else {
      // Update activity time
      this.lastActivityTime = Date.now();
    }
  }

  // Public method with caching (requires user settings)
  static async getAccountBalance(userSettings: { host: string; port: number; client_id: number }): Promise<AccountSummary> {
    console.log('🏦 getAccountBalance called');

    // Return cached data if available (always return cache, never remove it)
    const cached = this.getCachedBalance();
    if (cached) {
      console.log('✅ Using cached balance data');
      // Start background refresh if cache is older than 30 minutes
      if (this.shouldAutoRefresh(this.balanceCache)) {
        console.log('Starting background refresh for account balance (30+ minutes old)');
        this.refreshBalanceBackground(userSettings).catch(console.error);
      }
      return cached;
    }

    // No cache available, fetch fresh data and save to cache
    console.log('❌ No cached balance available, fetching fresh data');
    const freshData = await this.fetchAccountBalanceFresh(userSettings);
    this.setCachedBalance(freshData);
    return freshData;
  }



  // Force refresh method (for manual refresh button)
  static async forceRefreshAccountBalance(userSettings?: { host: string; port: number; client_id: number }): Promise<AccountSummary> {
    console.log('Force refreshing account balance');
    const freshData = await this.fetchAccountBalanceFresh(userSettings);
    this.setCachedBalance(freshData);
    LastUpdateService.updateIBPortfolioTime();
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
            console.error('Error canceling account summary:', err);
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
          }
        };

        const summaryEndHandler = (_reqId: number) => {
          if (_reqId === reqId && !isResolved) {
            const netLiquidation = parseFloat(this.accountSummaryData.get('NetLiquidation') || '0');
            const totalCashValue = parseFloat(this.accountSummaryData.get('TotalCashValue') || '0');
            const currency = this.accountSummaryData.get('Currency') || 'USD';

            cleanup();

            resolve({
              balance: netLiquidation || totalCashValue,
              currency: currency,
              netLiquidation: netLiquidation,
              totalCashValue: totalCashValue
            });
          }
        };

        this.ibApi!.on(EventName.accountSummary, summaryHandler);
        this.ibApi!.on(EventName.accountSummaryEnd, summaryEndHandler);

        // Request account summary
        this.ibApi!.reqAccountSummary(
          reqId,
          'All',
          'NetLiquidation,TotalCashValue,Currency'
        );
      });
    } catch (error) {
      this.isRequestInProgress = false;
      throw error;
    }
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
      console.log(`Skipping bond market data for ${position.symbol} (previously failed)`);
      return null;
    }

    console.log(`Requesting bond market data for ${position.symbol}...`);

    // If we don't have a contract ID, we can't reliably request market data for bonds
    if (!position.conId || position.conId <= 0) {
      console.log(`No contract ID available for bond ${position.symbol}, cannot request market data`);
      this.failedBondSymbols.add(position.symbol); // Mark as failed
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Timeout getting bond market data for ${position.symbol}`);
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
          console.log(`Bond tick data for ${position.symbol}: tickType=${tickType}, price=${price}`);

          if (tickType === 4) { // Last Price (current)
            if (price > 0) {
              lastPrice = price;
              console.log(`Got last price for ${position.symbol}: ${price}`);
            } else {
              lastPriceIsZero = true;
              console.log(`Last price reported as 0 for ${position.symbol}, will skip CHG/CHG% calculation`);
            }
          } else if (tickType === 9 && price > 0) { // Close Price (previous day)
            closePrice = price;
            console.log(`Got close price for ${position.symbol}: ${price}`);
          } else if (tickType === 1 && lastPrice === null && price > 0) { // Bid price as fallback for last price
            lastPrice = price;
            console.log(`Using bid price as last price for ${position.symbol}: ${price}`);
          } else if (tickType === 2 && lastPrice === null && price > 0) { // Ask price as fallback for last price
            lastPrice = price;
            console.log(`Using ask price as last price for ${position.symbol}: ${price}`);
          }

          // If we have both prices, decide whether to calculate and return
          if (lastPrice !== null && closePrice !== null && !dataReceived) {
            dataReceived = true;
            clearTimeout(timeout);
            this.ibApi!.removeListener('tickPrice' as any, tickPriceHandler);
            this.ibApi!.cancelMktData(reqId);

            // Do not calculate CHG/CHG% when lastPrice is 0 or non-positive
            if (lastPriceIsZero || lastPrice <= 0) {
              console.log(`Skipping CHG/CHG% for bond ${position.symbol} because lastPrice=0 or non-positive (lastPrice=${lastPrice})`);
              resolve(null);
              return;
            }

            // Also skip if closePrice is non-positive to avoid invalid % calculations
            if (closePrice <= 0) {
              console.log(`Skipping CHG/CHG% for bond ${position.symbol}: closePrice=${closePrice} (non-positive)`);
              resolve(null);
              return;
            }

            const dayChange = (lastPrice - closePrice) * position.position;
            const dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;

            console.log(`Calculated bond day change for ${position.symbol}: lastPrice=${lastPrice}, closePrice=${closePrice}, dayChange=${dayChange}, dayChangePercent=${dayChangePercent.toFixed(2)}%`);

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
          console.log(`Bond market data error for ${position.symbol}: ${errorCode} - ${errorString}`);
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

        console.log(`Using contract ID for bond market data: ${position.conId}`);

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

        console.log(`Requested market data for bond ${position.symbol} (conId: ${position.conId}) with reqId ${reqId}`);

      } catch (error) {
        console.error(`Error requesting bond market data for ${position.symbol}:`, error);
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

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Timeout getting historical data for ${contract.symbol} (${contract.secType})`);
        this.ibApi!.removeAllListeners('historicalData' as any);
        resolve(undefined);
      }, 8000); // Increased timeout for crypto/bonds

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
              console.log(`Final close price for ${contract.symbol} (${contract.secType}): ${closePrice} (from ${closePrices.length} bars)`);
              resolve(closePrice);
            }
          } else if (close > 0) {
            // Collect all close prices
            closePrices.push(close);
            console.log(`Historical bar for ${contract.symbol} (${contract.secType}): date=${time}, close=${close}`);
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
        console.error(`Error requesting historical data for ${contract.symbol} (${contract.secType}):`, error);
        clearTimeout(timeout);
        this.ibApi!.removeListener('historicalData' as any, historicalDataHandler);
        resolve(undefined);
      }
    });
  }

  // Public method with caching (requires user settings)
  static async getPortfolio(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<PortfolioPosition[]> {
    console.log('📈 getPortfolio called');

    // Return cached data if available
    const cached = this.getCachedPortfolio();
    if (cached) {
      console.log('✅ Using cached portfolio data (memory)');
      if (this.shouldAutoRefresh(this.portfolioCache)) {
        console.log('Starting background refresh for portfolio (30+ minutes old)');
        this.refreshPortfolioBackground(userSettings as any).catch(console.error);
      }
      return cached;
    }

    // Attempt to load from DB first (primary persistence)
    const mainAccountId = (userSettings as any)?.target_account_id ?? null;
    const dbData = await this.loadPortfolioFromDB(mainAccountId);
    if (dbData.length > 0) {
      this.setCachedPortfolio(dbData);
      console.log('✅ Using portfolio data from DB');
      // Background refresh if DB data is stale
      if (this.shouldAutoRefresh(this.portfolioCache)) {
        console.log('Starting background refresh for portfolio (DB data considered stale by policy)');
        this.refreshPortfolioBackground(userSettings as any).catch(console.error);
      }
      return dbData;
    }

    // No DB data, fetch fresh from IB, persist to DB, and cache in memory
    console.log('❌ No DB portfolio available, fetching fresh data from IB');
    const freshData = await this.fetchPortfolioFresh(userSettings as any);
    this.setCachedPortfolio(freshData);
    return freshData;
  }



  // Force refresh method (for manual refresh button)
  static async forceRefreshPortfolio(userSettings?: { host: string; port: number; client_id: number }): Promise<PortfolioPosition[]> {
    console.log('📊 Force refreshing portfolio...');
    const refreshStartTime = Date.now();
    
    // Clear failed bonds cache on manual refresh to retry them
    if (this.failedBondSymbols.size > 0) {
      console.log(`📊 Clearing ${this.failedBondSymbols.size} failed bond symbols for retry`);
      this.failedBondSymbols.clear();
    }
    
    const freshData = await this.fetchPortfolioFresh(userSettings);
    this.setCachedPortfolio(freshData);
    LastUpdateService.updateIBPortfolioTime();
    
    const refreshEndTime = Date.now();
    const totalDuration = refreshEndTime - refreshStartTime;
    console.log(`📊 Portfolio refresh completed in ${totalDuration}ms (${freshData.length} positions)`);
    
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
      console.log('Waiting for account summary to fully complete...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isPortfolioRequestInProgress = true;

    try {
      await this.ensureConnection(userSettings);

      if (!this.ibApi) {
        throw new Error('IB API not initialized');
      }

      this.portfolioPositions = [];
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
            console.log('Unsubscribed from account updates');
          } catch (err) {
            console.error('Error unsubscribing from account updates:', err);
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
          // Skip cash positions
          if (contract.secType === 'CASH') {
            return;
          }

          // Log contract details to see what's available
          console.log('Portfolio contract:', {
            symbol: contract.symbol,
            secType: contract.secType,
            exchange: contract.exchange,
            primaryExchange: contract.primaryExchange,
            currency: contract.currency,
            conId: contract.conId
          });

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
            primaryExchange: contract.primaryExchange || '',
            conId: contract.conId || 0
          });
        };

        const downloadEndHandler = async (accountName: string) => {
          if (!isResolved) {
            // Stop the initial wait timer now that account data download ended
            clearTimeout(timeout);
            
            console.log(`📊 Starting enrichment of ${this.portfolioPositions.length} positions...`);
            const enrichmentStartTime = Date.now();
            
            // Fetch contract details and market data for each position
            const enrichedPositions = await Promise.all(
              this.portfolioPositions.map(async (position) => {
                try {
                  let enrichedPosition = { ...position };

                  if (position.conId && ['STK', 'CRYPTO', 'BOND'].includes(position.secType)) {
                    console.log(`Processing ${position.symbol} (${position.secType}) for day change data...`);

                    // Handle bonds with market data approach directly
                    if (position.secType === 'BOND') {
                      console.log(`Using market data approach for bond ${position.symbol}...`);

                      // Set basic bond info
                      enrichedPosition = {
                        ...enrichedPosition,
                        industry: 'Fixed Income',
                        category: 'Bond',
                        country: position.exchange || position.primaryExchange || 'Unknown'
                      };

                      // Get bond data using market data ticks
                      const bondMarketData = await this.getBondMarketData(position);
                      if (bondMarketData && bondMarketData.closePrice > 0) {
                        enrichedPosition.closePrice = bondMarketData.closePrice;
                        enrichedPosition.dayChange = bondMarketData.dayChange;
                        enrichedPosition.dayChangePercent = bondMarketData.dayChangePercent;
                        console.log(`Got bond market data for ${position.symbol}: closePrice=${bondMarketData.closePrice}, dayChange=${bondMarketData.dayChange}, dayChangePercent=${bondMarketData.dayChangePercent.toFixed(2)}%`);
                      } else {
                        console.log(`Bond market data failed for ${position.symbol}`);
                      }
                    } else {
                      // Handle stocks and crypto with contract details and historical data
                      const details = await this.getContractDetails(position.conId);
                      if (details) {
                        console.log(`Got contract details for ${position.symbol} (${position.secType})`);

                        // Set industry/category for stocks and crypto
                        if (position.secType === 'STK') {
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: details.industry || '',
                            category: details.category || '',
                            country: details.contract?.primaryExchange || position.primaryExchange || ''
                          };
                        } else if (position.secType === 'CRYPTO') {
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: 'Cryptocurrency',
                            category: 'Digital Asset',
                            country: details.contract?.exchange || position.exchange || 'Crypto Exchange'
                          };
                        }

                        // Get historical close price
                        console.log(`Requesting historical data for ${position.symbol} (${position.secType})...`);
                        let closePrice = await this.getHistoricalClose(details.contract);
                        console.log(`Historical data result for ${position.symbol} (${position.secType}): closePrice=${closePrice}`);



                        if (closePrice && closePrice > 0) {
                          enrichedPosition.closePrice = closePrice;

                          // Calculate day change: (marketPrice - closePrice) * qty
                          const dayChange = (position.marketPrice - closePrice) * position.position;
                          // Calculate day change percent: ((marketPrice - closePrice) / closePrice) * 100
                          const dayChangePercent = ((position.marketPrice - closePrice) / closePrice) * 100;

                          enrichedPosition.dayChange = dayChange;
                          enrichedPosition.dayChangePercent = dayChangePercent;

                          console.log(`${position.symbol} (${position.secType}): closePrice=${closePrice}, marketPrice=${position.marketPrice}, dayChange=${dayChange}, dayChangePercent=${dayChangePercent.toFixed(2)}%`);
                        } else {
                          console.log(`${position.symbol} (${position.secType}): Could not get historical close price`);
                        }
                      } else {
                        console.log(`Failed to get contract details for ${position.symbol} (${position.secType})`);

                        // For crypto without contract details, set basic info but no day change data
                        if (position.secType === 'CRYPTO') {
                          console.log(`Contract details failed for crypto ${position.symbol}, cannot get day change data`);

                          // Set basic crypto info without contract details
                          enrichedPosition = {
                            ...enrichedPosition,
                            industry: 'Cryptocurrency',
                            category: 'Digital Asset',
                            country: position.exchange || 'Crypto Exchange'
                          };
                        }
                      }
                    }
                  }

                  return enrichedPosition;
                } catch (error) {
                  console.error(`Failed to get details for ${position.symbol}:`, error);
                  return position;
                }
              })
            );

            const enrichmentEndTime = Date.now();
            const enrichmentDuration = enrichmentEndTime - enrichmentStartTime;
            console.log(`📊 Position enrichment completed in ${enrichmentDuration}ms`);

            // Persist to DB if we have a target account to associate with
            try {
              if (typeof (mainAccountId) === 'number') {
                const dbStartTime = Date.now();
                await this.savePortfolioToDB(mainAccountId, enrichedPositions);
                const dbEndTime = Date.now();
                const dbDuration = dbEndTime - dbStartTime;
                console.log(`📊 Database persistence completed in ${dbDuration}ms`);
              } else {
                console.warn('⚠️ No target_account_id provided; skipping DB persist for IB portfolio');
              }
            } catch (e) {
              console.error('❌ Error persisting IB portfolio to DB:', e);
            }

            // Update in-memory cache
            this.setCachedPortfolio(enrichedPositions);

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

  // Combined method for frontend (returns cached data immediately, refreshes in background)
  static async getAccountData(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
    const [balance, portfolio] = await Promise.all([
      this.getAccountBalance(userSettings),
      this.getPortfolio(userSettings)
    ]);

    return { balance, portfolio };
  }

  // Force refresh both balance and portfolio
  static async forceRefreshAll(userSettings: { host: string; port: number; client_id: number }): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
    console.log('Force refreshing all account data');

    const [balance, portfolio] = await Promise.all([
      this.forceRefreshAccountBalance(userSettings),
      this.forceRefreshPortfolio(userSettings)
    ]);

    return { balance, portfolio };
  }

  // Get cache status for debugging
  static getCacheStatus(): { balance: string; portfolio: string } {
    const balanceAge = this.balanceCache ? Date.now() - this.balanceCache.timestamp : null;
    const portfolioAge = this.portfolioCache ? Date.now() - this.portfolioCache.timestamp : null;

    return {
      balance: balanceAge ? `${Math.round(balanceAge / 1000)}s old` : 'No cache',
      portfolio: portfolioAge ? `${Math.round(portfolioAge / 1000)}s old` : 'No cache'
    };
  }

  // Get balance timestamp
  static getBalanceTimestamp(): number | null {
    return this.balanceCache ? this.balanceCache.timestamp : null;
  }

  // Get portfolio timestamp
  static getPortfolioTimestamp(): number | null {
    return this.portfolioCache ? this.portfolioCache.timestamp : null;
  }

  // Get cache statistics for reporting
  static getCacheStats(): {
    balance: { hasCache: boolean; timestamp: number | null; ageMinutes: number | null; isRefreshing: boolean };
    portfolio: { hasCache: boolean; timestamp: number | null; ageMinutes: number | null; isRefreshing: boolean };
  } {
    const now = Date.now();

    return {
      balance: {
        hasCache: !!this.balanceCache,
        timestamp: this.balanceCache?.timestamp || null,
        ageMinutes: this.balanceCache ? Math.round((now - this.balanceCache.timestamp) / 1000 / 60) : null,
        isRefreshing: this.balanceCache?.isRefreshing || false
      },
      portfolio: {
        hasCache: !!this.portfolioCache,
        timestamp: this.portfolioCache?.timestamp || null,
        ageMinutes: this.portfolioCache ? Math.round((now - this.portfolioCache.timestamp) / 1000 / 60) : null,
        isRefreshing: this.portfolioCache?.isRefreshing || false
      }
    };
  }
}