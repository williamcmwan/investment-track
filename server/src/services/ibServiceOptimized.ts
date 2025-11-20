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

export class IBServiceOptimized {
  private static ibApi: IBApi | null = null;
  private static isConnected = false;
  private static isConnecting = false;
  private static connectionPromise: Promise<void> | null = null;
  
  // Storage for account data
  private static accountData: {
    accountValues: Map<string, { value: string; currency: string }>;
    portfolioPositions: Map<number, PortfolioPosition>; // Use Map with conId as key
  } = {
    accountValues: new Map(),
    portfolioPositions: new Map()
  };
  
  // Subscription tracking
  private static activeSubscriptions = {
    accountUpdates: false
  };
  
  // Track contract details already fetched to avoid redundant calls
  private static contractDetailsCache = new Map<number, any>();
  
  // Store mainAccountId for continuous updates
  private static currentMainAccountId: number | null = null;

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
  }

  static async disconnect(): Promise<void> {
    Logger.info('🔌 Disconnecting from IB Gateway...');
    this.stopAllSubscriptions();
    
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

    // Store mainAccountId for continuous updates
    this.currentMainAccountId = mainAccountId;
    
    // Clear temporary storage for fresh data
    this.accountData.accountValues.clear();
    this.accountData.portfolioPositions.clear();

    // Step 1: Subscribe to reqAccountUpdates() and wait for data
    await this.subscribeToAccountUpdates(mainAccountId);

    // Step 2: Fetch close prices from Yahoo Finance for all positions (always fresh, no cache)
    const positions = Array.from(this.accountData.portfolioPositions.values());
    await this.fetchClosePricesFromYahoo(positions, mainAccountId, false);

    // Step 3: Fetch contract details only for positions missing industry/category
    await this.fetchMissingContractDetails(positions);

    // Step 4: Sync everything to database
    await this.syncToDatabase(mainAccountId);

    // Step 5: Return current data
    return this.getCurrentData(mainAccountId);
  }

  /**
   * Subscribe to account updates - gets account values, cash balances, and positions
   * Syncs directly to database when download completes
   */
  private static async subscribeToAccountUpdates(mainAccountId: number): Promise<void> {
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
      const accountValueHandler = async (key: string, value: string, currency: string, accountName: string) => {
        // Use composite key for cash balances to handle multiple currencies
        const mapKey = (key === 'CashBalance' || key === 'TotalCashBalance') 
          ? `${key}_${currency}` 
          : key;
        
        this.accountData.accountValues.set(mapKey, {
          value,
          currency
        });
        Logger.debug(`💰 Account value: ${key} = ${value} ${currency}`);
        
        // If initial download is complete and this is NetLiquidation, update account balance immediately
        if (downloadComplete && key === 'NetLiquidation' && this.currentMainAccountId) {
          await this.syncAccountBalance(this.currentMainAccountId);
        }
      };

      // Handle portfolio position updates
      const portfolioHandler = async (
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

        const conId = contract.conId || 0;
        const positionData: PortfolioPosition = {
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
          conId
        };
        
        // Update or add position in map
        this.accountData.portfolioPositions.set(conId, positionData);
        
        Logger.debug(`📊 Position update: ${contract.symbol} (${contract.secType}) - ${position} @ ${marketPrice}`);
        
        // If initial download is complete, sync this position to database immediately
        if (downloadComplete && this.currentMainAccountId) {
          await this.syncSinglePosition(positionData, this.currentMainAccountId);
        }
      };

      // Handle download end
      const downloadEndHandler = (accountName: string) => {
        if (!downloadComplete) {
          downloadComplete = true;
          clearTimeout(timeout);
          Logger.debug(`Initial account data download complete: ${this.accountData.portfolioPositions.size} positions`);
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
   * Fetch close prices from Yahoo Finance for all positions
   * @param useCache - If true, uses database cache when available. If false, always fetches fresh from Yahoo Finance
   */
  private static async fetchClosePricesFromYahoo(positions: PortfolioPosition[], mainAccountId: number, useCache: boolean = false): Promise<void> {
    const { dbAll } = await import('../database/connection.js');
    const { YahooFinanceService } = await import('./yahooFinanceService.js');
    
    Logger.info(`📊 Fetching close prices for ${positions.length} positions... (useCache: ${useCache})`);
    
    const symbolsToFetch: string[] = [];
    const symbolToPosition = new Map<string, PortfolioPosition>();
    
    if (useCache) {
      // Try to use cached close prices first
      Logger.debug(`Loading cached close prices from database...`);
      
      const cachedCloses = await dbAll(
        `SELECT con_id, close_price 
         FROM portfolios 
         WHERE source = 'IB' 
         AND main_account_id = ?
         AND close_price IS NOT NULL 
         AND close_price > 0`,
        [mainAccountId]
      );
      
      const closeCache = new Map<number, number>();
      for (const row of cachedCloses) {
        closeCache.set(row.con_id, row.close_price);
      }
      
      Logger.debug(`Found ${closeCache.size} cached close prices`);
      
      // Apply cached close prices and collect symbols that need fetching
      for (const position of positions) {
        if (!position.conId || position.conId <= 0) {
          continue;
        }
        
        if (closeCache.has(position.conId)) {
          position.closePrice = closeCache.get(position.conId)!;
          Logger.debug(`${position.symbol} - Using cached close price: ${position.closePrice}`);
        } else {
          const yahooSymbol = this.convertToYahooSymbol(position.symbol, position.exchange || position.primaryExchange, position.secType);
          symbolsToFetch.push(yahooSymbol);
          symbolToPosition.set(yahooSymbol, position);
        }
      }
    } else {
      // Always fetch fresh from Yahoo Finance (no cache)
      Logger.info(`🌐 Fetching fresh close prices from Yahoo Finance (ignoring cache)...`);
      
      for (const position of positions) {
        if (!position.conId || position.conId <= 0) {
          continue;
        }
        
        const yahooSymbol = this.convertToYahooSymbol(position.symbol, position.exchange || position.primaryExchange, position.secType);
        symbolsToFetch.push(yahooSymbol);
        symbolToPosition.set(yahooSymbol, position);
      }
    }
    
    if (symbolsToFetch.length === 0) {
      Logger.info('✅ All positions have cached close prices');
      return;
    }
    
    // Fetch close prices from Yahoo Finance
    Logger.info(`🌐 Fetching ${symbolsToFetch.length} close prices from Yahoo Finance...`);
    const marketDataResults = await YahooFinanceService.getMultipleMarketData(symbolsToFetch);
    
    // Update positions with fetched close prices
    let fetchedCount = 0;
    for (const [yahooSymbol, marketData] of marketDataResults.entries()) {
      const position = symbolToPosition.get(yahooSymbol);
      if (position && marketData.closePrice > 0) {
        position.closePrice = marketData.closePrice;
        fetchedCount++;
        Logger.debug(`${position.symbol} (${yahooSymbol}): close price = ${marketData.closePrice} (from Yahoo Finance)`);
      }
    }
    
    Logger.info(`✅ Fetched ${fetchedCount} fresh close prices from Yahoo Finance`);
  }

  /**
   * Convert IB symbol to Yahoo Finance symbol format
   * Adds exchange suffixes for non-US stocks and crypto
   */
  private static convertToYahooSymbol(symbol: string, exchange?: string, secType?: string): string {
    // Crypto: Add -USD suffix
    // e.g. ETH -> ETH-USD, BTC -> BTC-USD
    if (secType === 'CRYPTO') {
      return `${symbol}-USD`;
    }
    
    if (!exchange) {
      return symbol;
    }

    const exchangeUpper = exchange.toUpperCase();
    
    // Canadian stocks need .TO suffix
    // Special handling for symbols ending with .UN -> convert to -UN.TO
    // e.g. REI.UN -> REI-UN.TO
    if (exchangeUpper === 'TSE' || exchangeUpper === 'VENTURE' || exchangeUpper === 'TSXV') {
      if (symbol.endsWith('.UN')) {
        // Remove .UN and add -UN.TO
        const baseSymbol = symbol.substring(0, symbol.length - 3);
        return `${baseSymbol}-UN.TO`;
      }
      // Regular Canadian stocks: VDY -> VDY.TO
      return `${symbol}.TO`;
    }
    
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
    
    // US stocks don't need suffix
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
   * Sync account data to database
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

      const syncDuration = Date.now() - syncStart;
      Logger.debug(`Database sync complete in ${syncDuration}ms`);
    } catch (error) {
      Logger.error('❌ Database sync failed:', error);
    }
  }

  private static async syncAccountBalance(mainAccountId: number): Promise<void> {
    const netLiq = this.accountData.accountValues.get('NetLiquidation');
    const currency = this.accountData.accountValues.get('Currency');

    if (!netLiq) {
      Logger.warn('No NetLiquidation value to sync');
      return;
    }

    const balance = parseFloat(netLiq.value);
    const currencyCode = currency?.value || 'USD';

    // Get user ID from account
    const { dbGet } = await import('../database/connection.js');
    const account = await dbGet('SELECT user_id FROM accounts WHERE id = ?', [mainAccountId]);
    
    if (!account) {
      Logger.error('Account not found for balance sync');
      return;
    }

    // Use AccountModel helper to update balance and add history
    const { AccountModel } = await import('../models/Account.js');
    await AccountModel.updateBalanceWithHistory(
      mainAccountId,
      account.user_id,
      balance,
      'IB auto-refresh'
    );

    Logger.debug(`💾 Synced account balance: ${balance} ${currencyCode}`);
  }

  /**
   * Sync a single position to database (for real-time updates)
   */
  private static async syncSinglePosition(position: PortfolioPosition, mainAccountId: number): Promise<void> {
    try {
      const { dbRun, dbGet } = await import('../database/connection.js');
      
      // Get close price from database if not in position
      if (!position.closePrice) {
        const cached = await dbGet(
          'SELECT close_price FROM portfolios WHERE con_id = ? AND source = ? AND main_account_id = ?',
          [position.conId, 'IB', mainAccountId]
        );
        if (cached && cached.close_price) {
          position.closePrice = cached.close_price;
        }
      }
      
      // Calculate day change
      const closePrice = position.closePrice;
      const lastPrice = position.marketPrice;
      let dayChange = null;
      let dayChangePercent = null;
      
      if (closePrice && lastPrice && closePrice > 0 && lastPrice !== closePrice) {
        if (position.secType === 'BOND') {
          dayChange = (lastPrice - closePrice) * position.position * 10;
          dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
        } else {
          dayChange = (lastPrice - closePrice) * position.position;
          dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
        }
      }
      
      // Update existing position in database
      await dbRun(`
        UPDATE portfolios 
        SET 
          quantity = ?,
          average_cost = ?,
          market_price = ?,
          market_value = ?,
          day_change = ?,
          day_change_percent = ?,
          unrealized_pnl = ?,
          realized_pnl = ?,
          last_price_update = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE con_id = ? AND source = ? AND main_account_id = ?
      `, [
        position.position, position.averageCost, position.marketPrice, position.marketValue,
        dayChange, dayChangePercent, position.unrealizedPNL, position.realizedPNL,
        position.conId, 'IB', mainAccountId
      ]);
      
      Logger.debug(`💾 Updated ${position.symbol}: price=${position.marketPrice}`);
    } catch (error) {
      Logger.error(`Failed to sync position ${position.symbol}:`, error);
    }
  }

  private static async syncPortfolio(mainAccountId: number): Promise<void> {
    const positions = Array.from(this.accountData.portfolioPositions.values());
    
    if (positions.length === 0) {
      Logger.debug('No positions to sync');
      return;
    }

    Logger.debug(`📊 Syncing ${positions.length} positions`);

    // Calculate day change for each position
    const enrichedPositions = positions.map(pos => {
      const closePrice = pos.closePrice;
      const lastPrice = pos.marketPrice;
      
      Logger.debug(`${pos.symbol}: marketPrice=${lastPrice}, closePrice=${closePrice}`);
      
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
        
        Logger.debug(`  Day change: ${dayChange?.toFixed(2)} (${dayChangePercent?.toFixed(2)}%)`);
      }
      
      return {
        ...pos,
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
    Logger.debug(`Received ${this.accountData.accountValues.size} account values`);
    
    // Extract cash balances from account values
    // Keys are now in format "CashBalance_USD", "CashBalance_HKD", etc.
    for (const [key, data] of this.accountData.accountValues.entries()) {
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
    Logger.debug('Portfolio refresh stopped');
  }

  /**
   * Get refresh status
   */
  static getRefreshStatus(): {
    isActive: boolean;
    subscriptions: {
      accountUpdates: boolean;
    };
  } {
    return {
      isActive: this.activeSubscriptions.accountUpdates,
      subscriptions: {
        accountUpdates: this.activeSubscriptions.accountUpdates
      }
    };
  }

  /**
   * Refresh close prices for all IB positions from Yahoo Finance
   * This should be called periodically (e.g., every 30 minutes or after market close)
   */
  static async refreshClosePrices(mainAccountId: number): Promise<void> {
    try {
      const { dbAll, dbRun } = await import('../database/connection.js');
      
      Logger.info(`🔄 Refreshing close prices for IB account ${mainAccountId}...`);
      
      // Get all positions for this account
      const rows = await dbAll(
        'SELECT * FROM portfolios WHERE main_account_id = ? AND source = ? ORDER BY symbol',
        [mainAccountId, 'IB']
      );
      
      if (rows.length === 0) {
        Logger.info('No IB positions found to refresh');
        return;
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
        exchange: row.exchange,
        primaryExchange: row.primary_exchange,
        conId: row.con_id,
        closePrice: row.close_price
      }));
      
      // Fetch fresh close prices from Yahoo Finance (no cache)
      await this.fetchClosePricesFromYahoo(positions, mainAccountId, false);
      
      // Update database with new close prices and recalculate day changes
      let updatedCount = 0;
      for (const position of positions) {
        if (!position.closePrice || !position.conId) continue;
        
        // Calculate day change
        const closePrice = position.closePrice;
        const lastPrice = position.marketPrice;
        let dayChange = null;
        let dayChangePercent = null;
        
        if (closePrice && lastPrice && closePrice > 0 && lastPrice !== closePrice) {
          if (position.secType === 'BOND') {
            dayChange = (lastPrice - closePrice) * position.position * 10;
            dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
          } else {
            dayChange = (lastPrice - closePrice) * position.position;
            dayChangePercent = ((lastPrice - closePrice) / closePrice) * 100;
          }
        }
        
        // Update database
        await dbRun(`
          UPDATE portfolios 
          SET 
            close_price = ?,
            day_change = ?,
            day_change_percent = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE con_id = ? AND source = ? AND main_account_id = ?
        `, [
          position.closePrice,
          dayChange,
          dayChangePercent,
          position.conId,
          'IB',
          mainAccountId
        ]);
        
        updatedCount++;
        Logger.debug(`Updated ${position.symbol}: close=${position.closePrice}, dayChange=${dayChange?.toFixed(2)}`);
      }
      
      Logger.info(`✅ Refreshed close prices for ${updatedCount} IB positions`);
      
    } catch (error) {
      Logger.error('Error refreshing IB close prices:', error);
      throw error;
    }
  }

  /**
   * Refresh close prices for all users' IB accounts
   */
  static async refreshAllClosePrices(): Promise<void> {
    try {
      const { dbAll } = await import('../database/connection.js');
      
      Logger.info('🔄 Refreshing close prices for all IB accounts...');
      
      // Get all accounts with IB integration
      const accounts = await dbAll(`
        SELECT DISTINCT a.id, a.user_id, a.name
        FROM accounts a
        INNER JOIN account_integrations ai ON a.id = ai.account_id
        WHERE ai.type = 'IB'
      `);
      
      if (accounts.length === 0) {
        Logger.info('No IB accounts found');
        return;
      }
      
      Logger.info(`Found ${accounts.length} IB account(s) to refresh`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const account of accounts) {
        try {
          await this.refreshClosePrices(account.id);
          successCount++;
        } catch (error) {
          Logger.error(`Failed to refresh close prices for account ${account.name}:`, error);
          errorCount++;
        }
      }
      
      Logger.info(`✅ Close price refresh complete: ${successCount} successful, ${errorCount} failed`);
      
    } catch (error) {
      Logger.error('Error in refreshAllClosePrices:', error);
      throw error;
    }
  }

  /**
   * Copy current bond prices to close prices for end-of-day snapshot
   * This is needed because IB doesn't provide close prices for bonds via AccountUpdate
   * Should be called at 23:59 before daily snapshot calculation
   */
  static async copyBondPricesToClose(): Promise<void> {
    try {
      const { dbAll, dbRun } = await import('../database/connection.js');
      
      Logger.info('📋 Copying current bond prices to close prices for IB portfolios...');
      
      // Get all bond positions from IB portfolios
      const bonds = await dbAll(`
        SELECT id, main_account_id, symbol, market_price, close_price, sec_type
        FROM portfolios
        WHERE source = 'IB' 
        AND sec_type = 'BOND'
        AND market_price IS NOT NULL
        AND market_price > 0
      `);
      
      if (bonds.length === 0) {
        Logger.info('No IB bond positions found');
        return;
      }
      
      Logger.info(`Found ${bonds.length} IB bond position(s) to update`);
      
      let updatedCount = 0;
      for (const bond of bonds) {
        try {
          // Copy market_price to close_price
          await dbRun(`
            UPDATE portfolios
            SET close_price = market_price,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [bond.id]);
          
          updatedCount++;
          Logger.debug(`Updated ${bond.symbol}: close_price = ${bond.market_price} (copied from market_price)`);
        } catch (error) {
          Logger.error(`Failed to update close price for bond ${bond.symbol}:`, error);
        }
      }
      
      Logger.info(`✅ Copied ${updatedCount} bond prices to close prices`);
      
    } catch (error) {
      Logger.error('Error in copyBondPricesToClose:', error);
      throw error;
    }
  }
}
