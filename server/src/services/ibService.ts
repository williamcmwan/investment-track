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
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  isRefreshing?: boolean;
}

export class IBService {
  private static ibApi: IBApi | null = null;
  private static isConnected = false;
  private static accountSummaryData: Map<string, string> = new Map();
  private static activeReqId: number | null = null;
  private static isRequestInProgress = false;
  private static lastReqId = 0;
  private static portfolioPositions: PortfolioPosition[] = [];
  private static isPortfolioRequestInProgress = false;

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

  static getConnectionSettings(): { host: string; port: number; clientId: number } {
    return {
      host: process.env.IB_HOST || 'localhost',
      port: parseInt(process.env.IB_PORT || '4001'),
      clientId: parseInt(process.env.IB_CLIENT_ID || '1')
    };
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

  private static async connect(): Promise<void> {
    if (this.isConnected && this.ibApi) {
      return;
    }

    // If there's an existing connection, disconnect first
    if (this.ibApi) {
      try {
        console.log('Disconnecting existing IB API connection...');
        this.ibApi.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
      this.ibApi = null;
      this.isConnected = false;
    }

    const settings = this.getConnectionSettings();
    console.log(`Connecting to IB Gateway with client ID ${settings.clientId}...`);
    
    this.ibApi = new IBApi({
      host: settings.host,
      port: settings.port,
      clientId: settings.clientId
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - ensure TWS/Gateway is running'));
      }, 10000);

      this.ibApi!.on(EventName.connected, () => {
        this.isConnected = true;
        clearTimeout(timeout);
        console.log('Successfully connected to IB Gateway');
        resolve();
      });

      this.ibApi!.on(EventName.disconnected, () => {
        console.log('Disconnected from IB Gateway');
        this.isConnected = false;
      });

      this.ibApi!.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
        console.error(`IB API Error [${code}]:`, err.message);
        
        // Handle "client id already in use" error
        if (err.message.includes('client id is already in use')) {
          clearTimeout(timeout);
          reject(new Error('Client ID already in use. Please disconnect other applications or change IB_CLIENT_ID in .env'));
        } else if (!this.isConnected) {
          clearTimeout(timeout);
          reject(new Error(`IB API Error: ${err.message}`));
        }
      });

      this.ibApi!.connect();
    });
  }

  static async disconnect(): Promise<void> {
    console.log('Disconnecting from IB Gateway...');
    
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
          this.ibApi.disconnect();
          // Wait a bit for clean disconnect
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error('Error during disconnect:', err);
        }
        this.isConnected = false;
      }
      
      this.ibApi = null;
    }
    
    console.log('Disconnected from IB Gateway');
  }

  // Public method with caching
  static async getAccountBalance(): Promise<AccountSummary> {
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
        this.refreshAccountBalanceBackground().catch(console.error);
      }
      return cached;
    }

    // No cache available, fetch fresh data and save to cache
    console.log('❌ No cached balance available, fetching fresh data');
    const freshData = await this.fetchAccountBalanceFresh();
    this.setCachedBalance(freshData);
    return freshData;
  }

  // Background refresh method
  private static async refreshAccountBalanceBackground(): Promise<void> {
    try {
      const freshData = await this.fetchAccountBalanceFresh();
      this.setCachedBalance(freshData);
    } catch (error) {
      console.error('Background balance refresh failed:', error);
      if (this.balanceCache) {
        this.balanceCache.isRefreshing = false;
      }
    }
  }

  // Force refresh method (for manual refresh button)
  static async forceRefreshAccountBalance(): Promise<AccountSummary> {
    console.log('Force refreshing account balance');
    const freshData = await this.fetchAccountBalanceFresh();
    this.setCachedBalance(freshData);
    return freshData;
  }

  // Internal method that actually fetches from IB
  private static async fetchAccountBalanceFresh(): Promise<AccountSummary> {
    // Wait if another request is in progress
    while (this.isRequestInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isRequestInProgress = true;

    try {
      await this.connect();

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

      const detailsHandler = (reqId_: number, contractDetails: any) => {
        if (reqId_ === reqId) {
          clearTimeout(timeout);
          this.ibApi!.off(EventName.contractDetails, detailsHandler);
          this.ibApi!.off(EventName.contractDetailsEnd, endHandler);
          resolve(contractDetails);
        }
      };

      const endHandler = (reqId_: number) => {
        if (reqId_ === reqId) {
          clearTimeout(timeout);
          this.ibApi!.off(EventName.contractDetails, detailsHandler);
          this.ibApi!.off(EventName.contractDetailsEnd, endHandler);
          resolve(null);
        }
      };

      this.ibApi!.on(EventName.contractDetails, detailsHandler);
      this.ibApi!.on(EventName.contractDetailsEnd, endHandler);

      // Request contract details by conId
      this.ibApi!.reqContractDetails(reqId, { conId });
    });
  }

  // Public method with caching
  static async getPortfolio(): Promise<PortfolioPosition[]> {
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
        this.refreshPortfolioBackground().catch(console.error);
      }
      return cached;
    }

    // No cache available, fetch fresh data and save to cache
    console.log('❌ No cached portfolio available, fetching fresh data');
    const freshData = await this.fetchPortfolioFresh();
    this.setCachedPortfolio(freshData);
    return freshData;
  }

  // Background refresh method
  private static async refreshPortfolioBackground(): Promise<void> {
    try {
      const freshData = await this.fetchPortfolioFresh();
      this.setCachedPortfolio(freshData);
    } catch (error) {
      console.error('Background portfolio refresh failed:', error);
      if (this.portfolioCache) {
        this.portfolioCache.isRefreshing = false;
      }
    }
  }

  // Force refresh method (for manual refresh button)
  static async forceRefreshPortfolio(): Promise<PortfolioPosition[]> {
    console.log('Force refreshing portfolio');
    const freshData = await this.fetchPortfolioFresh();
    this.setCachedPortfolio(freshData);
    return freshData;
  }

  // Internal method that actually fetches from IB
  private static async fetchPortfolioFresh(): Promise<PortfolioPosition[]> {
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
      await this.connect();

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
  static async getAccountData(): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
    const [balance, portfolio] = await Promise.all([
      this.getAccountBalance(),
      this.getPortfolio()
    ]);

    return { balance, portfolio };
  }

  // Force refresh both balance and portfolio
  static async forceRefreshAll(): Promise<{ balance: AccountSummary; portfolio: PortfolioPosition[] }> {
    console.log('Force refreshing all account data');
    
    const [balance, portfolio] = await Promise.all([
      this.forceRefreshAccountBalance(),
      this.forceRefreshPortfolio()
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
}