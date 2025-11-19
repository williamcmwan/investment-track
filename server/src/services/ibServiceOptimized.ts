import { IBApi, EventName, ErrorCode } from '@stoqey/ib';
import { Logger } from '../utils/logger.js';

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

// Temporary in-memory storage for real-time updates
interface TemporaryDataStore {
  accountValues: Map<string, { value: string; currency: string; timestamp: number }>;
  portfolioUpdates: Map<string, PortfolioPosition & { timestamp: number }>;
  marketData: Map<number, { lastPrice: number; closePrice: number; timestamp: number }>;
  lastDbSync: number;
}


export class IBServiceOptimized {
  private static ibApi: IBApi | null = null;
  private static isConnected = false;
  private static isConnecting = false;
  private static connectionPromise: Promise<void> | null = null;
  
  // Temporary storage for real-time updates
  private static tempStore: TemporaryDataStore = {
    accountValues: new Map(),
    portfolioUpdates: new Map(),
    marketData: new Map(),
    lastDbSync: 0
  };
  
  // Subscription tracking
  private static activeSubscriptions = {
    accountUpdates: false,
    marketDataReqIds: new Set<number>()
  };
  
  // Sync interval (1 minute)
  private static readonly DB_SYNC_INTERVAL = 60 * 1000;
  private static syncTimer: NodeJS.Timeout | null = null;
  
  // Track contract details already fetched to avoid redundant calls
  private static contractDetailsCache = new Map<number, any>();
  
  // Track reqId to symbol mapping for better logging
  private static reqIdToSymbol = new Map<number, string>();

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

  private static async connect(userSettings?: { host: string; port: number; client_id: number }): Promise<void> {
    if (this.isConnected && this.ibApi) {
      Logger.info('✅ Already connected to IB Gateway');
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      Logger.info('⏳ Connection in progress, waiting...');
      return this.connectionPromise;
    }

    this.isConnecting = true;
    const settings = this.getUserConnectionSettings(userSettings);
    Logger.info(`🔌 Connecting to IB Gateway at ${settings.host}:${settings.port}...`);

    this.connectionPromise = new Promise((resolve, reject) => {
      this.ibApi = new IBApi({
        host: settings.host,
        port: settings.port,
        clientId: settings.clientId
      });

      const timeout = setTimeout(() => {
        Logger.error('❌ Connection timeout');
        this.cleanupConnection();
        reject(new Error('Connection timeout - ensure TWS/Gateway is running'));
      }, 20000);

      this.ibApi!.on(EventName.connected, () => {
        this.isConnected = true;
        this.isConnecting = false;
        clearTimeout(timeout);
        Logger.info('✅ Connected to IB Gateway');
        resolve();
      });

      this.ibApi!.on(EventName.disconnected, () => {
        Logger.info('⚠️ Disconnected from IB Gateway');
        this.handleDisconnection();
      });

      this.ibApi!.on(EventName.error, (err: Error, code: ErrorCode, reqId: number) => {
        // Filter out informational/expected errors
        const numCode = Number(code);
        if (numCode === 10167) {
          // Delayed market data notification
          Logger.debug(`IB API Info [${code}]: ${err.message}`);
        } else if (numCode === 321) {
          // Historical data validation errors (expected for some securities)
          Logger.debug(`IB API Info [${code}]: ${err.message}`);
        } else if (numCode === 200) {
          // No security definition found (expected for some securities)
          Logger.debug(`IB API Info [${code}]: ${err.message}`);
        } else {
          Logger.error(`❌ IB API Error [${code}]:`, err.message);
        }
        
        if (!this.isConnected && this.isConnecting) {
          clearTimeout(timeout);
          this.cleanupConnection();
          reject(new Error(`IB API Error: ${err.message}`));
        }
      });

      try {
        this.ibApi!.connect();
      } catch (err) {
        clearTimeout(timeout);
        this.cleanupConnection();
        reject(err);
      }
    });

    return this.connectionPromise;
  }

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
    this.isConnecting = false;
    this.connectionPromise = null;
  }

  private static handleDisconnection(): void {
    this.isConnected = false;
    this.stopAllSubscriptions();
    this.stopSyncTimer();
  }

  static async disconnect(): Promise<void> {
    Logger.info('🔌 Disconnecting from IB Gateway...');
    this.stopAllSubscriptions();
    this.stopSyncTimer();
    
    if (this.ibApi && this.isConnected) {
      try {
        this.ibApi.removeAllListeners();
        this.ibApi.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        Logger.error('Error during disconnect:', err);
      }
    }
    
    this.ibApi = null;
    this.isConnected = false;
    Logger.info('✅ Disconnected from IB Gateway');
  }


  /**
   * Main refresh method - subscribes to all data streams with minimal API calls
   * Uses subscriptions that update temporary storage, syncing to DB every minute
   */
  static async refreshPortfolio(userSettings: { host: string; port: number; client_id: number; target_account_id?: number }): Promise<{
    balance: AccountSummary;
    portfolio: PortfolioPosition[];
    cashBalances: CashBalance[];
  }> {
    Logger.debug('Starting optimized portfolio refresh...');
    const mainAccountId = userSettings.target_account_id;
    
    if (!mainAccountId) {
      throw new Error('target_account_id is required');
    }

    await this.connect(userSettings);
    
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    // Clear temporary storage for fresh data
    this.tempStore.accountValues.clear();
    this.tempStore.portfolioUpdates.clear();
    this.tempStore.marketData.clear();

    // Step 1: Subscribe to reqAccountUpdates() - gets account values, cash, and positions
    await this.subscribeToAccountUpdates();

    // Step 2: Wait for initial data to populate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Get positions and subscribe to market data for each
    const positions = Array.from(this.tempStore.portfolioUpdates.values());
    Logger.debug(`Found ${positions.length} positions, subscribing to market data...`);

    // Step 4: Subscribe to market data (reqMktData) for all positions
    await this.subscribeToMarketData(positions);

    // Step 5: Fetch close prices for positions (using historical data as fallback)
    await this.fetchClosePrices(positions);

    // Step 6: Fetch contract details only for positions missing industry/category
    await this.fetchMissingContractDetails(positions);

    // Step 7: Sync to database immediately
    await this.syncToDatabase(mainAccountId);

    // Step 8: Start periodic sync timer (every 1 minute)
    this.startSyncTimer(mainAccountId);

    // Step 9: Fetch historical close prices in background (after startup completes)
    this.fetchHistoricalClosePricesInBackground(positions, mainAccountId);

    // Step 10: Return current data
    return this.getCurrentData(mainAccountId);
  }

  /**
   * Subscribe to account updates - gets account values, cash balances, and positions
   * This is a single subscription that provides multiple data types
   */
  private static async subscribeToAccountUpdates(): Promise<void> {
    if (!this.ibApi || !this.isConnected) {
      throw new Error('Not connected to IB');
    }

    if (this.activeSubscriptions.accountUpdates) {
      Logger.debug('Already subscribed to account updates');
      return;
    }

    Logger.debug('Subscribing to account updates...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout subscribing to account updates'));
      }, 15000);

      let downloadComplete = false;

      // Handle account value updates (cash balances, net liquidation, etc.)
      const accountValueHandler = (key: string, value: string, currency: string, accountName: string) => {
        // Use composite key for cash balances to handle multiple currencies
        // IB sends "CashBalance" multiple times with different currencies
        const mapKey = (key === 'CashBalance' || key === 'TotalCashBalance') 
          ? `${key}_${currency}` 
          : key;
        
        this.tempStore.accountValues.set(mapKey, {
          value,
          currency,
          timestamp: Date.now()
        });
        Logger.debug(`💰 Account value: ${key} = ${value} ${currency} (stored as: ${mapKey})`);
      };

      // Handle portfolio position updates
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
        // Skip cash positions (handled by account values)
        if (contract.secType === 'CASH') {
          return;
        }

        const key = `${contract.conId}_${contract.symbol}`;
        this.tempStore.portfolioUpdates.set(key, {
          symbol: contract.symbol || '',
          secType: contract.secType || '',
          currency: contract.currency || '',
          position,
          averageCost: averageCost || 0,
          marketPrice,
          marketValue,
          unrealizedPNL: unrealizedPNL || 0,
          realizedPNL: realizedPNL || 0,
          exchange: contract.exchange || '',
          primaryExchange: contract.primaryExch || '',
          conId: contract.conId || 0,
          timestamp: Date.now()
        });
        
        Logger.debug(`📊 Position update: ${contract.symbol} (${contract.secType}) - ${position} @ ${marketPrice}`);
      };

      // Handle download end
      const downloadEndHandler = (accountName: string) => {
        if (!downloadComplete) {
          downloadComplete = true;
          clearTimeout(timeout);
          Logger.debug('Initial account data download complete');
          this.activeSubscriptions.accountUpdates = true;
          resolve();
        }
      };

      this.ibApi!.on(EventName.updateAccountValue, accountValueHandler);
      this.ibApi!.on(EventName.updatePortfolio, portfolioHandler);
      this.ibApi!.on(EventName.accountDownloadEnd, downloadEndHandler);

      // Subscribe to account updates (this stays active until we unsubscribe)
      this.ibApi!.reqAccountUpdates(true, '');
    });
  }


  /**
   * Subscribe to market data for all positions
   * Gets last price and close price via streaming updates
   */
  private static async subscribeToMarketData(positions: PortfolioPosition[]): Promise<void> {
    if (!this.ibApi || !this.isConnected) {
      throw new Error('Not connected to IB');
    }

    Logger.debug(`Subscribing to market data for ${positions.length} positions...`);

    // Set market data type to delayed (free)
    this.ibApi.reqMarketDataType(3);

    for (const position of positions) {
      if (!position.conId || position.conId <= 0) {
        Logger.debug(`Skipping market data for ${position.symbol} - no contract ID`);
        continue;
      }

      const reqId = position.conId; // Use conId as reqId for easy tracking
      
      // Skip if already subscribed
      if (this.activeSubscriptions.marketDataReqIds.has(reqId)) {
        continue;
      }

      const contract = {
        conId: position.conId,
        secType: position.secType as any,
        exchange: position.primaryExchange || position.exchange || 'SMART',
        currency: position.currency || 'USD'
      };

      try {
        // Subscribe to market data (this stays active)
        // Generic tick list: empty string '' gets default ticks (bid, ask, last, close, volume, etc.)
        // For delayed data, IB automatically sends tick 68 (delayed last) and 69 (delayed close)
        // For real-time data, IB sends tick 4 (last) and 9 (close)
        // No need to specify tick types explicitly - IB sends appropriate ticks based on subscription level
        this.ibApi.reqMktData(reqId, contract, '', false, false);
        this.activeSubscriptions.marketDataReqIds.add(reqId);
        
        // Store symbol mapping for better logging
        this.reqIdToSymbol.set(reqId, `${position.symbol} (${position.secType}, ${position.exchange || position.primaryExchange})`);
        
        Logger.debug(`Subscribed to market data for ${position.symbol}`);
      } catch (error) {
        Logger.error(`Failed to subscribe to market data for ${position.symbol}:`, error);
      }
    }

    // Set up market data handler (only once)
    if (!this.ibApi.listenerCount('tickPrice' as any)) {
      this.ibApi.on('tickPrice' as any, (reqId: number, tickType: number, price: number) => {
        const symbol = this.reqIdToSymbol.get(reqId) || `reqId ${reqId}`;
        
        if (price <= 0) return;

        const existing = this.tempStore.marketData.get(reqId) || { lastPrice: 0, closePrice: 0, timestamp: 0 };

        // Last Price (Current Price)
        // Priority: 4 (Last) > 68 (Delayed Last)
        if (tickType === 4) {
          existing.lastPrice = price;
          existing.timestamp = Date.now();
        } 
        else if (tickType === 68 && existing.lastPrice === 0) {
          // Use delayed last only if we don't have real-time last
          existing.lastPrice = price;
          existing.timestamp = Date.now();
        }
        // Close Price (Previous Day Close)
        // Priority: 9 (Close) > 69 (Delayed Close)
        else if (tickType === 9) {
          existing.closePrice = price;
          existing.timestamp = Date.now();
        }
        else if (tickType === 69 && existing.closePrice === 0) {
          // Use delayed close only if we don't have real-time close
          existing.closePrice = price;
          existing.timestamp = Date.now();
        }

        this.tempStore.marketData.set(reqId, existing);
      });
    }

    Logger.debug('Market data subscriptions active');
  }

  /**
   * Fetch close prices for stocks using cached values from database
   * Bonds and crypto get close price from ticks
   * Historical data requests are skipped to avoid startup delays
   */
  private static async fetchClosePrices(positions: PortfolioPosition[]): Promise<void> {
    const { dbAll } = await import('../database/connection.js');
    
    Logger.debug(`Loading cached close prices from database...`);
    
    // Get cached close prices from database (from previous sync)
    const cachedCloses = await dbAll(
      `SELECT con_id, close_price 
       FROM portfolios 
       WHERE source = 'IB' 
       AND close_price IS NOT NULL 
       AND close_price > 0`,
      []
    );
    
    const closeCache = new Map<number, number>();
    for (const row of cachedCloses) {
      closeCache.set(row.con_id, row.close_price);
    }
    
    Logger.debug(`Found ${closeCache.size} cached close prices`);
    
    for (const position of positions) {
      if (!position.conId || position.conId <= 0) {
        continue;
      }
      
      // Skip bonds and crypto - they get close price from ticks
      if (position.secType === 'BOND' || position.secType === 'CRYPTO') {
        continue;
      }
      
      // Check if we already have close price from market data tick
      const marketData = this.tempStore.marketData.get(position.conId);
      if (marketData && marketData.closePrice > 0) {
        continue;
      }
      
      // Use cached close price from database
      if (closeCache.has(position.conId)) {
        const cachedClose = closeCache.get(position.conId)!;
        const existing = this.tempStore.marketData.get(position.conId) || { lastPrice: 0, closePrice: 0, timestamp: 0 };
        existing.closePrice = cachedClose;
        existing.timestamp = Date.now();
        this.tempStore.marketData.set(position.conId, existing);
        Logger.debug(`${position.symbol} - Using cached close price`);
      }
    }
    
    Logger.debug('Close price loading complete');
  }

  /**
   * Fetch close prices from Yahoo Finance in background (non-blocking)
   * This runs after startup completes to avoid delaying the initial response
   */
  private static fetchHistoricalClosePricesInBackground(positions: PortfolioPosition[], mainAccountId: number): void {
    // Run in background after a short delay
    setTimeout(async () => {
      Logger.debug('Starting background close price fetch from Yahoo Finance...');
      
      const { YahooFinanceService } = await import('./yahooFinanceService.js');
      
      // Collect symbols that need close prices
      const symbolsToFetch: string[] = [];
      const symbolToConId = new Map<string, number>();
      const yahooSymbolToOriginal = new Map<string, string>();
      
      for (const position of positions) {
        if (!position.conId || position.conId <= 0) {
          continue;
        }
        
        // Skip bonds and crypto - they get close price from ticks
        if (position.secType === 'BOND' || position.secType === 'CRYPTO') {
          continue;
        }
        
        // Skip if we already have close price
        const marketData = this.tempStore.marketData.get(position.conId);
        if (marketData && marketData.closePrice > 0) {
          continue;
        }
        
        // Convert symbol to Yahoo Finance format
        const yahooSymbol = this.convertToYahooSymbol(position.symbol, position.exchange || position.primaryExchange);
        symbolsToFetch.push(yahooSymbol);
        symbolToConId.set(yahooSymbol, position.conId);
        yahooSymbolToOriginal.set(yahooSymbol, position.symbol);
      }
      
      if (symbolsToFetch.length === 0) {
        Logger.debug('No symbols need close prices');
        return;
      }
      
      // Fetch close prices from Yahoo Finance
      Logger.debug(`Fetching close prices for ${symbolsToFetch.length} symbols from Yahoo Finance...`);
      const marketDataResults = await YahooFinanceService.getMultipleMarketData(symbolsToFetch);
      
      // Update market data with fetched close prices
      let fetchedCount = 0;
      for (const [yahooSymbol, marketData] of marketDataResults.entries()) {
        const conId = symbolToConId.get(yahooSymbol);
        const originalSymbol = yahooSymbolToOriginal.get(yahooSymbol);
        if (conId && marketData.closePrice > 0) {
          const existing = this.tempStore.marketData.get(conId) || { lastPrice: 0, closePrice: 0, timestamp: 0 };
          existing.closePrice = marketData.closePrice;
          existing.timestamp = Date.now();
          this.tempStore.marketData.set(conId, existing);
          fetchedCount++;
          Logger.debug(`${originalSymbol} (${yahooSymbol}): close price = ${marketData.closePrice}`);
        }
      }
      
      // Sync to database if we fetched any close prices
      if (fetchedCount > 0) {
        Logger.debug(`Background fetch complete: ${fetchedCount} close prices fetched from Yahoo Finance`);
        await this.syncToDatabase(mainAccountId);
      } else {
        Logger.debug('Background fetch complete: no new close prices');
      }
    }, 5000); // Start after 5 seconds
  }

  /**
   * Convert IB symbol to Yahoo Finance symbol format
   * Adds exchange suffixes for non-US stocks
   */
  private static convertToYahooSymbol(symbol: string, exchange?: string): string {
    if (!exchange) {
      return symbol;
    }

    const exchangeUpper = exchange.toUpperCase();
    
    // Singapore stocks need .SI suffix
    if (exchangeUpper === 'SGX' || exchangeUpper === 'SGXCENT') {
      return `${symbol}.SI`;
    }
    
    // Hong Kong stocks need .HK suffix
    if (exchangeUpper === 'SEHK' || exchangeUpper === 'HKFE') {
      return `${symbol}.HK`;
    }
    
    // London stocks need .L suffix
    if (exchangeUpper === 'LSE') {
      return `${symbol}.L`;
    }
    
    // Australian stocks need .AX suffix
    if (exchangeUpper === 'ASX') {
      return `${symbol}.AX`;
    }
    
    // German stocks need .DE suffix (Frankfurt)
    if (exchangeUpper === 'FWB' || exchangeUpper === 'IBIS') {
      return `${symbol}.DE`;
    }
    
    // US and Canadian stocks don't need suffix
    return symbol;
  }

  /**
   * Get yesterday's close price using historical data
   */
  private static async getHistoricalClose(position: PortfolioPosition): Promise<number> {
    if (!this.ibApi) {
      throw new Error('IB API not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ibApi!.off(EventName.historicalData, historicalDataHandler);
        this.ibApi!.off('historicalDataEnd' as any, historicalDataEndHandler);
        this.ibApi!.off(EventName.error, errorHandler);
        reject(new Error(`Timeout`));
      }, 15000); // Increased to 15 seconds

      const reqId = Math.floor(Math.random() * 10000) + 20000;
      let closePrice = 0;

      const historicalDataHandler = (reqId_: number, bar: any) => {
        if (reqId_ === reqId && bar && bar.close) {
          closePrice = bar.close;
          Logger.debug(`Historical data for ${position.symbol}: close=${bar.close}`);
        }
      };

      const historicalDataEndHandler = (reqId_: number) => {
        if (reqId_ === reqId) {
          clearTimeout(timeout);
          this.ibApi!.off(EventName.historicalData, historicalDataHandler);
          this.ibApi!.off('historicalDataEnd' as any, historicalDataEndHandler);
          resolve(closePrice);
        }
      };

      const errorHandler = (err: Error, code: ErrorCode, reqId_: number) => {
        if (reqId_ === reqId) {
          clearTimeout(timeout);
          this.ibApi!.off(EventName.historicalData, historicalDataHandler);
          this.ibApi!.off('historicalDataEnd' as any, historicalDataEndHandler);
          this.ibApi!.off(EventName.error, errorHandler);
          reject(new Error(`IB Error ${code}: ${err.message}`));
        }
      };

      this.ibApi!.on(EventName.historicalData, historicalDataHandler);
      this.ibApi!.on('historicalDataEnd' as any, historicalDataEndHandler);
      this.ibApi!.on(EventName.error, errorHandler);

      // Build contract with all available details
      const contract: any = {
        conId: position.conId,
        symbol: position.symbol,
        secType: position.secType,
        currency: position.currency,
        exchange: 'SMART' // Use SMART as default exchange for routing
      };
      
      // Add primary exchange if available (for stocks)
      if (position.primaryExchange) {
        contract.primaryExch = position.primaryExchange;
      } else if (position.exchange && position.exchange !== 'SMART') {
        contract.primaryExch = position.exchange;
      }

      // Request 1 day of historical data to get yesterday's close
      this.ibApi!.reqHistoricalData(
        reqId,
        contract,
        '', // endDateTime - empty means current time
        '1 D', // duration - 1 day
        '1 day' as any, // barSize - daily bars
        'TRADES', // whatToShow
        1, // useRTH - regular trading hours only
        1, // formatDate
        false // keepUpToDate
      );
    });
  }

  /**
   * Fetch contract details only for positions missing industry/category
   * Minimizes API calls by only fetching when needed
   */
  private static async fetchMissingContractDetails(positions: PortfolioPosition[]): Promise<void> {
    if (!this.ibApi || !this.isConnected) {
      throw new Error('Not connected to IB');
    }

    // Check database for existing industry/category data
    const { dbAll } = await import('../database/connection.js');
    const existingData = await dbAll(
      'SELECT con_id, industry, category, country FROM portfolios WHERE source = ? AND con_id IS NOT NULL',
      ['IB']
    );

    const existingMap = new Map<number, { industry: string; category: string; country: string }>();
    for (const row of existingData) {
      if (row.industry && row.category) {
        existingMap.set(row.con_id, {
          industry: row.industry,
          category: row.category,
          country: row.country || ''
        });
      }
    }

    const positionsNeedingDetails = positions.filter(p => {
      if (!p.conId) return false;
      
      // Check cache first
      if (this.contractDetailsCache.has(p.conId)) {
        return false;
      }
      
      // Check database
      if (existingMap.has(p.conId)) {
        const existing = existingMap.get(p.conId)!;
        // Update position with cached data
        p.industry = existing.industry;
        p.category = existing.category;
        p.country = existing.country;
        return false;
      }
      
      return true;
    });

    if (positionsNeedingDetails.length === 0) {
      Logger.debug('All positions have contract details');
      return;
    }

    Logger.debug(`Fetching contract details for ${positionsNeedingDetails.length} positions...`);

    for (const position of positionsNeedingDetails) {
      try {
        const details = await this.getContractDetails(position.conId!);
        
        if (details) {
          // Cache the details
          this.contractDetailsCache.set(position.conId!, details);
          
          // Update position
          position.industry = details.industry || (position.secType === 'CRYPTO' ? 'Cryptocurrency' : '');
          position.category = details.category || (position.secType === 'CRYPTO' ? 'Digital Asset' : '');
          position.country = this.deriveCountryFromExchange(
            details.contract?.primaryExch || details.contract?.exchange,
            position.symbol
          );
          
          Logger.debug(`📋 Got contract details for ${position.symbol}: ${position.industry} / ${position.category}`);
        }
      } catch (error) {
        Logger.error(`Failed to get contract details for ${position.symbol}:`, error);
      }
    }

    Logger.debug('Contract details fetch complete');
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
      this.ibApi!.reqContractDetails(reqId, { conId });
    });
  }

  private static deriveCountryFromExchange(exchange?: string, symbol?: string): string {
    if (symbol && symbol.startsWith('US-T')) {
      return 'United States';
    }

    if (!exchange) return '';

    const exchangeCountryMap: Record<string, string> = {
      'NYSE': 'United States', 'NASDAQ': 'United States', 'ARCA': 'United States',
      'AMEX': 'United States', 'BATS': 'United States', 'LSE': 'United Kingdom',
      'SEHK': 'Hong Kong', 'HKFE': 'Hong Kong', 'JPX': 'Japan', 'TSE': 'Canada',
      'ASX': 'Australia', 'SGX': 'Singapore', 'FWB': 'Germany', 'SWB': 'Germany'
    };

    return exchangeCountryMap[exchange.toUpperCase()] || '';
  }

  /**
   * Sync temporary storage to database
   * Called every minute and on-demand
   */
  private static async syncToDatabase(mainAccountId: number): Promise<void> {
    Logger.debug('Syncing data to database...');
    const syncStart = Date.now();

    try {
      // Sync account balance
      await this.syncAccountBalance(mainAccountId);

      // Sync portfolio positions
      await this.syncPortfolio(mainAccountId);

      // Sync cash balances
      await this.syncCashBalances(mainAccountId);

      this.tempStore.lastDbSync = Date.now();
      const syncDuration = Date.now() - syncStart;
      Logger.debug(`Database sync complete in ${syncDuration}ms`);
    } catch (error) {
      Logger.error('❌ Database sync failed:', error);
    }
  }

  private static async syncAccountBalance(mainAccountId: number): Promise<void> {
    const netLiq = this.tempStore.accountValues.get('NetLiquidation');
    const currency = this.tempStore.accountValues.get('Currency');

    if (!netLiq) {
      Logger.warn('No NetLiquidation value to sync');
      return;
    }

    const { dbRun } = await import('../database/connection.js');
    await dbRun(`
      UPDATE accounts 
      SET current_balance = ?, currency = ?, last_updated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [parseFloat(netLiq.value), currency?.value || 'USD', mainAccountId]);

    Logger.debug(`💾 Synced account balance: ${netLiq.value} ${currency?.value || 'USD'}`);
  }

  private static async syncPortfolio(mainAccountId: number): Promise<void> {
    const positions = Array.from(this.tempStore.portfolioUpdates.values());
    
    if (positions.length === 0) {
      Logger.debug('No positions to sync');
      return;
    }

    Logger.debug(`📊 Syncing ${positions.length} positions with market data`);

    // Enrich positions with market data
    const enrichedPositions = positions.map(pos => {
      const marketData = this.tempStore.marketData.get(pos.conId || 0);
      
      // Determine close price and last price
      let closePrice = null;
      let lastPrice = pos.marketPrice;
      
      if (marketData) {
        // Use market data if available
        if (marketData.closePrice > 0) {
          closePrice = marketData.closePrice;
        }
        if (marketData.lastPrice > 0) {
          lastPrice = marketData.lastPrice;
        }
      }
      
      // If we don't have close price from market data, try to get it from database
      if (!closePrice && pos.closePrice && pos.closePrice > 0) {
        closePrice = pos.closePrice;
      }
      
      // Calculate day change only if we have both close and last price
      let dayChange = null;
      let dayChangePercent = null;
      
      if (closePrice && lastPrice && closePrice > 0 && lastPrice !== closePrice) {
        if (pos.secType === 'BOND') {
          // Bond formula: (lastPrice - closePrice) * qty * 10
          dayChange = (lastPrice - closePrice) * pos.position * 10;
          dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
        } else {
          // Stock/Crypto formula: (lastPrice - closePrice) * qty
          dayChange = (lastPrice - closePrice) * pos.position;
          dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
        }
        
        Logger.debug(`Day change for ${pos.symbol}: ${dayChange?.toFixed(2)} (${dayChangePercent?.toFixed(2)}%)`);
      }
      
      return {
        ...pos,
        closePrice,
        marketPrice: lastPrice,
        dayChange,
        dayChangePercent
      };
    });

    // Batch save to database
    const { dbRun } = await import('../database/connection.js');
    await dbRun('DELETE FROM portfolios WHERE source = ? AND main_account_id = ?', ['IB', mainAccountId]);

    if (enrichedPositions.length === 0) return;

    const valueClauses: string[] = [];
    const allParams: any[] = [];

    for (const p of enrichedPositions) {
      valueClauses.push(`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      allParams.push(
        mainAccountId, p.symbol, p.secType, p.currency, p.country || null,
        p.industry || null, p.category || null, p.position, p.averageCost,
        p.exchange || null, p.primaryExchange || null, p.conId || null,
        p.marketPrice, p.marketValue, p.dayChange || null, p.dayChangePercent || null,
        p.closePrice || null, p.unrealizedPNL, p.realizedPNL, null, 'IB'
      );
    }

    const sql = `
      INSERT INTO portfolios (
        main_account_id, symbol, sec_type, currency, country, industry, category,
        quantity, average_cost, exchange, primary_exchange, con_id,
        market_price, market_value, day_change, day_change_percent, close_price,
        unrealized_pnl, realized_pnl, notes, source, last_price_update, updated_at, created_at
      ) VALUES ${valueClauses.join(', ')}
    `;

    await dbRun(sql, allParams);
    Logger.debug(`💾 Synced ${enrichedPositions.length} portfolio positions`);
  }


  private static async syncCashBalances(mainAccountId: number): Promise<void> {
    const cashBalances: CashBalance[] = [];
    
    // Account values received
    Logger.debug(`Received ${this.tempStore.accountValues.size} account values`);
    
    // Extract cash balances from account values
    // Keys are now in format "CashBalance_USD", "CashBalance_HKD", etc.
    for (const [key, data] of this.tempStore.accountValues.entries()) {
      // Check for CashBalance_* or TotalCashBalance_* keys
      if (key.startsWith('CashBalance_') || key.startsWith('TotalCashBalance_')) {
        // Skip BASE currency (it's a summary)
        if (data.currency === 'BASE') {
          Logger.debug(`   Skipping BASE currency summary`);
          continue;
        }
        
        const amount = parseFloat(data.value);
        
        // Check if we already have this currency (avoid duplicates from both CashBalance and TotalCashBalance)
        const exists = cashBalances.find(cb => cb.currency === data.currency);
        if (!exists) {
          cashBalances.push({
            currency: data.currency,
            amount,
            marketValueHKD: amount
          });
          
          Logger.debug(`Found cash balance: ${data.currency}`);
        }
      }
    }

    if (cashBalances.length === 0) {
      Logger.warn('⚠️  No cash balances found in account values');
      return;
    }

    // Enrich with USD values
    const enrichedBalances = await this.enrichCashBalancesWithUSD(cashBalances);

    // Save to database
    const { dbRun } = await import('../database/connection.js');
    await dbRun('DELETE FROM cash_balances WHERE main_account_id = ? AND source = ?', [mainAccountId, 'IB']);

    for (const cash of enrichedBalances) {
      await dbRun(`
        INSERT INTO cash_balances (
          main_account_id, currency, amount, market_value_hkd, market_value_usd, source, 
          last_updated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [mainAccountId, cash.currency, cash.amount, cash.marketValueHKD, cash.marketValueUSD || null, 'IB']);
    }

    Logger.debug(`💾 Synced ${enrichedBalances.length} cash balances`);
  }

  private static async enrichCashBalancesWithUSD(cashBalances: CashBalance[]): Promise<CashBalance[]> {
    const enrichedBalances: CashBalance[] = [];

    for (const cash of cashBalances) {
      let marketValueUSD = cash.marketValueHKD;

      if (cash.currency !== 'USD') {
        try {
          const { ExchangeRateService } = await import('./exchangeRateService.js');
          const rate = await ExchangeRateService.getExchangeRate(cash.currency, 'USD');
          marketValueUSD = cash.marketValueHKD * rate;
        } catch (error) {
          Logger.error(`Failed to get USD rate for ${cash.currency}:`, error);
          marketValueUSD = cash.marketValueHKD;
        }
      }

      enrichedBalances.push({ ...cash, marketValueUSD });
    }

    return enrichedBalances;
  }

  /**
   * Start periodic sync timer (every 1 minute)
   */
  private static startSyncTimer(mainAccountId: number): void {
    if (this.syncTimer) {
      Logger.debug('Sync timer already running');
      return;
    }

    Logger.debug('Starting periodic database sync (every 1 minute)');
    
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncToDatabase(mainAccountId);
      } catch (error) {
        Logger.error('Periodic sync failed:', error);
      }
    }, this.DB_SYNC_INTERVAL);
  }

  /**
   * Stop periodic sync timer
   */
  private static stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      Logger.debug('Stopped periodic database sync');
    }
  }

  /**
   * Stop all active subscriptions
   */
  private static stopAllSubscriptions(): void {
    if (!this.ibApi) return;

    // Unsubscribe from account updates
    if (this.activeSubscriptions.accountUpdates) {
      try {
        this.ibApi.reqAccountUpdates(false, '');
        this.activeSubscriptions.accountUpdates = false;
        Logger.debug('Unsubscribed from account updates');
      } catch (error) {
        Logger.error('Error unsubscribing from account updates:', error);
      }
    }

    // Cancel all market data subscriptions
    for (const reqId of this.activeSubscriptions.marketDataReqIds) {
      try {
        this.ibApi.cancelMktData(reqId);
      } catch (error) {
        Logger.error(`Error canceling market data for reqId ${reqId}:`, error);
      }
    }
    this.activeSubscriptions.marketDataReqIds.clear();
    Logger.debug('Canceled all market data subscriptions');
  }

  /**
   * Get current data from database
   */
  private static async getCurrentData(mainAccountId: number): Promise<{
    balance: AccountSummary;
    portfolio: PortfolioPosition[];
    cashBalances: CashBalance[];
  }> {
    const { dbGet, dbAll } = await import('../database/connection.js');

    // Get account balance
    const account = await dbGet('SELECT current_balance, currency FROM accounts WHERE id = ?', [mainAccountId]);
    const balance: AccountSummary = {
      balance: account?.current_balance || 0,
      currency: account?.currency || 'USD',
      netLiquidation: account?.current_balance || 0
    };

    // Get portfolio
    const portfolioRows = await dbAll(
      'SELECT * FROM portfolios WHERE source = ? AND main_account_id = ? ORDER BY symbol',
      ['IB', mainAccountId]
    );
    const portfolio: PortfolioPosition[] = portfolioRows.map((row: any) => ({
      symbol: row.symbol,
      secType: row.sec_type,
      currency: row.currency,
      position: row.quantity,
      averageCost: row.average_cost,
      marketPrice: row.market_price || 0,
      marketValue: row.market_value || 0,
      unrealizedPNL: row.unrealized_pnl || 0,
      realizedPNL: row.realized_pnl || 0,
      exchange: row.exchange,
      primaryExchange: row.primary_exchange,
      conId: row.con_id,
      industry: row.industry,
      category: row.category,
      country: row.country,
      closePrice: row.close_price,
      dayChange: row.day_change,
      dayChangePercent: row.day_change_percent
    }));

    // Get cash balances
    const cashRows = await dbAll(
      'SELECT * FROM cash_balances WHERE main_account_id = ? AND source = ? ORDER BY currency',
      [mainAccountId, 'IB']
    );
    const cashBalances: CashBalance[] = cashRows.map((row: any) => ({
      currency: row.currency,
      amount: row.amount,
      marketValueHKD: row.market_value_hkd,
      marketValueUSD: row.market_value_usd
    }));

    return { balance, portfolio, cashBalances };
  }

  /**
   * Stop refresh and clean up
   */
  static async stopRefresh(): Promise<void> {
    Logger.debug('Stopping portfolio refresh...');
    this.stopAllSubscriptions();
    this.stopSyncTimer();
    Logger.debug('Portfolio refresh stopped');
  }

  /**
   * Get refresh status
   */
  static getRefreshStatus(): {
    isActive: boolean;
    lastSync: number;
    subscriptions: {
      accountUpdates: boolean;
      marketDataCount: number;
    };
  } {
    return {
      isActive: this.activeSubscriptions.accountUpdates || this.activeSubscriptions.marketDataReqIds.size > 0,
      lastSync: this.tempStore.lastDbSync,
      subscriptions: {
        accountUpdates: this.activeSubscriptions.accountUpdates,
        marketDataCount: this.activeSubscriptions.marketDataReqIds.size
      }
    };
  }
}
