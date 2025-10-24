import { IBApi, EventName, ErrorCode } from '@stoqey/ib';
import * as fs from 'fs';
import * as path from 'path';

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

  // Cache storage (in-memory for fast access)
  private static balanceCache: CachedData<AccountSummary> | null = null;
  private static portfolioCache: CachedData<PortfolioPosition[]> | null = null;

  // Cache expiration times (in milliseconds)
  private static readonly BALANCE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly PORTFOLIO_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  // Cache file paths
  private static readonly CACHE_DIR = path.join(process.cwd(), 'cache');
  private static readonly BALANCE_CACHE_FILE = path.join(IBService.CACHE_DIR, 'balance.json');
  private static readonly PORTFOLIO_CACHE_FILE = path.join(IBService.CACHE_DIR, 'portfolio.json');

  // Get user-specific connection settings
  static getUserConnectionSettings(userSettings: { host: string; port: number; client_id: number }): { host: string; port: number; clientId: number } {
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

  private static getCachedBalance(): AccountSummary | null {
    console.log('getCachedBalance called');
    
    // Check memory cache first
    if (this.isCacheValid(this.balanceCache, this.BALANCE_CACHE_DURATION)) {
      console.log('Returning cached account balance from memory');
      return this.balanceCache!.data;
    }

    // If memory cache is empty or expired, try loading from file
    if (!this.balanceCache) {
      console.log('Memory cache empty, trying to load from file:', this.BALANCE_CACHE_FILE);
      this.balanceCache = this.loadCacheFromFile<AccountSummary>(this.BALANCE_CACHE_FILE);
      if (this.isCacheValid(this.balanceCache, this.BALANCE_CACHE_DURATION)) {
        console.log('Returning cached account balance from file');
        return this.balanceCache!.data;
      } else {
        console.log('File cache invalid or not found');
      }
    }

    console.log('No valid cache found');
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
    
    // Check memory cache first
    if (this.isCacheValid(this.portfolioCache, this.PORTFOLIO_CACHE_DURATION)) {
      console.log('Returning cached portfolio from memory');
      return this.portfolioCache!.data;
    }

    // If memory cache is empty or expired, try loading from file
    if (!this.portfolioCache) {
      console.log('Memory cache empty, trying to load from file:', this.PORTFOLIO_CACHE_FILE);
      this.portfolioCache = this.loadCacheFromFile<PortfolioPosition[]>(this.PORTFOLIO_CACHE_FILE);
      if (this.isCacheValid(this.portfolioCache, this.PORTFOLIO_CACHE_DURATION)) {
        console.log('Returning cached portfolio from file');
        return this.portfolioCache!.data;
      } else {
        console.log('File cache invalid or not found');
      }
    }

    console.log('No valid portfolio cache found');
    return null;
  }

  private static setCachedPortfolio(data: PortfolioPosition[]): void {
    this.portfolioCache = {
      data,
      timestamp: Date.now(),
      isRefreshing: false
    };
    // Save to file for persistence
    this.saveCacheToFile(this.PORTFOLIO_CACHE_FILE, this.portfolioCache);
    console.log('Portfolio cached in memory and file');
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
    
    // Return cached data if available
    const cached = this.getCachedBalance();
    if (cached) {
      console.log('✅ Using cached balance data');
      // Start background refresh if cache is getting old (> 3 minutes)
      const cacheAge = Date.now() - this.balanceCache!.timestamp;
      if (cacheAge > 3 * 60 * 1000 && !this.balanceCache!.isRefreshing) {
        console.log('Starting background refresh for account balance');
        this.balanceCache!.isRefreshing = true;
        this.refreshAccountBalanceBackground(userSettings).catch(console.error);
      }
      return cached;
    }

    // No cache available, fetch fresh data and save to cache
    console.log('❌ No cached balance available, fetching fresh data');
    const freshData = await this.fetchAccountBalanceFresh(userSettings);
    this.setCachedBalance(freshData);
    return freshData;
  }

  // Background refresh method
  private static async refreshAccountBalanceBackground(userSettings: { host: string; port: number; client_id: number }): Promise<void> {
    try {
      const freshData = await this.fetchAccountBalanceFresh(userSettings);
      this.setCachedBalance(freshData);
    } catch (error) {
      console.error('Background balance refresh failed:', error);
      if (this.balanceCache) {
        this.balanceCache.isRefreshing = false;
      }
    }
  }

  // Force refresh method (for manual refresh button)
  static async forceRefreshAccountBalance(userSettings?: { host: string; port: number; client_id: number }): Promise<AccountSummary> {
    console.log('Force refreshing account balance');
    const freshData = await this.fetchAccountBalanceFresh(userSettings);
    this.setCachedBalance(freshData);
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

  private static async getHistoricalClose(contract: any): Promise<number | undefined> {
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Timeout getting historical data for ${contract.symbol}`);
        this.ibApi!.removeAllListeners('historicalData' as any);
        resolve(undefined);
      }, 5000);

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
              console.log(`Final close price for ${contract.symbol}: ${closePrice} (from ${closePrices.length} bars)`);
              resolve(closePrice);
            }
          } else if (close > 0) {
            // Collect all close prices
            closePrices.push(close);
            console.log(`Historical bar for ${contract.symbol}: date=${time}, close=${close}`);
          }
        }
      };

      this.ibApi!.on('historicalData' as any, historicalDataHandler);

      // Request 2 days of historical data to get previous close
      try {
        this.ibApi!.reqHistoricalData(
          reqId,
          contract,
          '', // endDateTime - empty means now
          '2 D', // duration - get 2 days
          '1 day' as any, // bar size - daily bars
          'TRADES', // what to show
          1, // useRTH - regular trading hours
          1, // formatDate
          false // keepUpToDate
        );
      } catch (error) {
        console.error(`Error requesting historical data for ${contract.symbol}:`, error);
        clearTimeout(timeout);
        this.ibApi!.removeListener('historicalData' as any, historicalDataHandler);
        resolve(undefined);
      }
    });
  }

  // Public method with caching (requires user settings)
  static async getPortfolio(userSettings: { host: string; port: number; client_id: number }): Promise<PortfolioPosition[]> {
    console.log('📈 getPortfolio called');
    
    // Return cached data if available
    const cached = this.getCachedPortfolio();
    if (cached) {
      console.log('✅ Using cached portfolio data');
      // Start background refresh if cache is getting old (> 10 minutes)
      const cacheAge = Date.now() - this.portfolioCache!.timestamp;
      if (cacheAge > 10 * 60 * 1000 && !this.portfolioCache!.isRefreshing) {
        console.log('Starting background refresh for portfolio');
        this.portfolioCache!.isRefreshing = true;
        this.refreshPortfolioBackground(userSettings).catch(console.error);
      }
      return cached;
    }

    // No cache available, fetch fresh data and save to cache
    console.log('❌ No cached portfolio available, fetching fresh data');
    const freshData = await this.fetchPortfolioFresh(userSettings);
    this.setCachedPortfolio(freshData);
    return freshData;
  }

  // Background refresh method
  private static async refreshPortfolioBackground(userSettings: { host: string; port: number; client_id: number }): Promise<void> {
    try {
      const freshData = await this.fetchPortfolioFresh(userSettings);
      this.setCachedPortfolio(freshData);
    } catch (error) {
      console.error('Background portfolio refresh failed:', error);
      if (this.portfolioCache) {
        this.portfolioCache.isRefreshing = false;
      }
    }
  }

  // Force refresh method (for manual refresh button)
  static async forceRefreshPortfolio(userSettings?: { host: string; port: number; client_id: number }): Promise<PortfolioPosition[]> {
    console.log('Force refreshing portfolio');
    const freshData = await this.fetchPortfolioFresh(userSettings);
    this.setCachedPortfolio(freshData);
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

      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            reject(new Error('Timeout waiting for portfolio data'));
          }
        }, 15000);

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
            // Fetch contract details and market data for each position
            const enrichedPositions = await Promise.all(
              this.portfolioPositions.map(async (position) => {
                try {
                  let enrichedPosition = { ...position };
                  
                  if (position.conId && position.secType === 'STK') {
                    // Get contract details for industry/category
                    const details = await this.getContractDetails(position.conId);
                    if (details) {
                      enrichedPosition = {
                        ...enrichedPosition,
                        industry: details.industry || '',
                        category: details.category || '',
                        country: details.contract?.primaryExchange || position.primaryExchange || ''
                      };
                      
                      // Get historical close price
                      const closePrice = await this.getHistoricalClose(details.contract);
                      if (closePrice && closePrice > 0) {
                        enrichedPosition.closePrice = closePrice;
                        
                        // Calculate day change: (marketPrice - closePrice) * qty
                        const dayChange = (position.marketPrice - closePrice) * position.position;
                        // Calculate day change percent: ((marketPrice - closePrice) / closePrice) * 100
                        const dayChangePercent = ((position.marketPrice - closePrice) / closePrice) * 100;
                        
                        enrichedPosition.dayChange = dayChange;
                        enrichedPosition.dayChangePercent = dayChangePercent;
                        
                        console.log(`${position.symbol}: closePrice=${closePrice}, marketPrice=${position.marketPrice}, dayChange=${dayChange}, dayChangePercent=${dayChangePercent.toFixed(2)}%`);
                      } else {
                        console.log(`${position.symbol}: Could not get historical close price`);
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
  static async getAccountData(userSettings: { host: string; port: number; client_id: number }): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
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
}