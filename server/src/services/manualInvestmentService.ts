import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { YahooFinanceService, MarketData } from './yahooFinanceService';



export interface ManualPosition {
  id: number;
  mainAccountId: number; // References the main accounts table
  symbol: string;
  secType: 'STK' | 'BOND' | 'CRYPTO' | 'ETF' | 'MUTUAL_FUND' | 'OTHER';
  currency: string;
  country?: string;
  industry?: string;
  category?: string;
  quantity: number;
  averageCost: number;
  exchange?: string;
  primaryExchange?: string;
  conId?: number;
  // Market data (from Yahoo Finance)
  marketPrice?: number;
  marketValue?: number;
  dayChange?: number;
  dayChangePercent?: number;
  closePrice?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastPriceUpdate?: string;
  source?: 'MANUAL' | 'IB';
}

export interface EnrichedManualPosition extends ManualPosition {
  accountName: string;
  // Additional Yahoo Finance data
  shortName?: string;
  longName?: string;
  sector?: string;
  marketState?: string;
}

export class ManualInvestmentService {
  private static db: Database.Database | null = null;
  private static lastRefreshTime: number | null = null;
  private static autoRefreshInterval: NodeJS.Timeout | null = null;
  private static readonly AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Convert database row (snake_case) to ManualPosition (camelCase)
   */
  private static mapDatabaseToPosition(row: any): ManualPosition {
    return {
      id: row.id,
      mainAccountId: row.main_account_id,
      symbol: row.symbol,
      secType: row.sec_type,
      currency: row.currency,
      country: row.country,
      industry: row.industry,
      category: row.category,
      quantity: row.quantity,
      averageCost: row.average_cost,
      exchange: row.exchange,
      primaryExchange: row.primary_exchange,
      conId: row.con_id,
      marketPrice: row.market_price,
      marketValue: row.market_value,
      dayChange: row.day_change,
      dayChangePercent: row.day_change_percent,
      closePrice: row.close_price,
      unrealizedPnl: row.unrealized_pnl,
      realizedPnl: row.realized_pnl,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastPriceUpdate: row.last_price_update,
      source: row.source
    };
  }

  private static getDatabase(): Database.Database {
    if (!this.db) {
      // Use the same database path as the main application
      const dbPath = process.env.DATABASE_PATH || './data/investment_tracker.db';
      
      // Ensure data directory exists
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    }
    return this.db;
  }

  /**
   * Initialize database tables
   */
  static async initializeDatabase(): Promise<void> {
    const db = this.getDatabase();
    try {
      console.log('📊 Initializing portfolios table');

      // Create unified portfolios table (IB + MANUAL)
      const createPortfolios = `
        CREATE TABLE IF NOT EXISTS portfolios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          main_account_id INTEGER NOT NULL,
          symbol TEXT NOT NULL,
          sec_type TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          country TEXT,
          industry TEXT,
          category TEXT,
          quantity REAL NOT NULL,
          average_cost REAL NOT NULL,
          exchange TEXT,
          primary_exchange TEXT,
          con_id INTEGER,
          market_price REAL,
          market_value REAL,
          day_change REAL,
          day_change_percent REAL,
          close_price REAL,
          unrealized_pnl REAL,
          realized_pnl REAL,
          notes TEXT,
          source TEXT NOT NULL DEFAULT 'MANUAL',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_price_update DATETIME
        );
      `;
      db.exec(createPortfolios);

      // Detect existing manual_positions table and migrate/rename if needed
      const tableExistsStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
      const manualExists = tableExistsStmt.get('manual_positions');
      const portfoliosExists = tableExistsStmt.get('portfolios');

      if (manualExists && portfoliosExists) {
        const countPortfolio = db.prepare('SELECT COUNT(1) as cnt FROM portfolios').get() as any;
        const countManual = db.prepare('SELECT COUNT(1) as cnt FROM manual_positions').get() as any;
        if ((countPortfolio?.cnt || 0) === 0 && (countManual?.cnt || 0) > 0) {
          console.log('🔄 Migrating data from manual_positions to portfolios...');
          const migrateInsert = `
            INSERT INTO portfolios (
              id, main_account_id, symbol, sec_type, currency, country, industry, category,
              quantity, average_cost, exchange, primary_exchange,
              market_price, market_value, day_change, day_change_percent, close_price,
              unrealized_pnl, notes, created_at, updated_at, last_price_update, source
            )
            SELECT
              id, main_account_id, symbol, sec_type, currency, country, industry, category,
              quantity, average_cost, exchange, primary_exchange,
              market_price, market_value, day_change, day_change_percent, close_price,
              unrealized_pnl, notes, created_at, updated_at, last_price_update, 'MANUAL'
            FROM manual_positions
          `;
          db.exec(migrateInsert);
          db.exec('DROP TABLE IF EXISTS manual_positions');
          console.log('✅ Migration from manual_positions completed and legacy table dropped');
        }
      } else if (manualExists && !portfoliosExists) {
        // Fallback: rename legacy table if portfolios did not exist for some reason
        try {
          console.log('🔁 Renaming manual_positions to portfolios...');
          db.exec('ALTER TABLE manual_positions RENAME TO portfolios');
          db.exec("ALTER TABLE portfolios ADD COLUMN con_id INTEGER");
          db.exec("ALTER TABLE portfolios ADD COLUMN realized_pnl REAL");
          db.exec("ALTER TABLE portfolios ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL'");
          console.log('✅ Legacy table renamed and columns added');
        } catch (err) {
          console.error('❌ Error renaming manual_positions to portfolios:', err);
        }
      }

      // Ensure required columns exist (idempotent)
      const cols = db.prepare("PRAGMA table_info(portfolios)").all() as any[];
      const names = new Set(cols.map(c => c.name));
      if (!names.has('con_id')) db.exec("ALTER TABLE portfolios ADD COLUMN con_id INTEGER");
      if (!names.has('realized_pnl')) db.exec("ALTER TABLE portfolios ADD COLUMN realized_pnl REAL");
      if (!names.has('source')) db.exec("ALTER TABLE portfolios ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL'");

      // Create indexes for performance
      db.exec("CREATE INDEX IF NOT EXISTS idx_portfolios_main_account_id ON portfolios(main_account_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_portfolios_symbol ON portfolios(symbol)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_portfolios_updated ON portfolios(last_price_update)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_portfolios_source ON portfolios(source)");

      // Cleanup: remove unused legacy table if present
      db.exec("DROP TABLE IF EXISTS investment_accounts");

      console.log('✅ Portfolios table initialized');
      
      // Start auto-refresh timer
      this.startAutoRefresh('default');
    } catch (error) {
      console.error('❌ Error initializing portfolios:', error);
    }
  }



  /**
   * Get all manual positions for a main account
   */
  static getManualPositions(mainAccountId: number): ManualPosition[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM portfolios
      WHERE main_account_id = ? AND source = 'MANUAL'
      ORDER BY symbol
    `);
    
    const rawPositions = stmt.all(mainAccountId) as any[];
    return rawPositions.map(row => this.mapDatabaseToPosition(row));
  }

  /**
   * Get all manual positions for a user (across all main accounts)
   * Note: This assumes we can access the main accounts table or get account names separately
   */
  static getAllManualPositions(userId: string = 'default'): ManualPosition[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM portfolios
      WHERE source = 'MANUAL'
      ORDER BY main_account_id, symbol
    `);
    
    const rawPositions = stmt.all() as any[];
    return rawPositions.map(row => this.mapDatabaseToPosition(row));
  }

  /**
   * Add a new manual position
   */
  static addManualPosition(position: Omit<ManualPosition, 'id' | 'createdAt' | 'updatedAt' | 'lastPriceUpdate'>): ManualPosition {
    console.log('📊 Adding manual position:', position);
    
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO portfolios (
        main_account_id, symbol, sec_type, currency, country, industry, category,
        quantity, average_cost, exchange, primary_exchange, notes, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const result = stmt.run(
        position.mainAccountId,
        position.symbol.toUpperCase(),
        position.secType,
        position.currency,
        position.country,
        position.industry,
        position.category,
        position.quantity,
        position.averageCost,
        position.exchange,
        position.primaryExchange,
        position.notes,
        'MANUAL'
      );
      
      console.log('✅ Position inserted with ID:', result.lastInsertRowid);
      
      // Return the created position
      const getStmt = db.prepare('SELECT * FROM portfolios WHERE id = ?');
      const rawPosition = getStmt.get(result.lastInsertRowid) as any;
      const createdPosition = this.mapDatabaseToPosition(rawPosition);
      console.log('📊 Created position:', createdPosition);
      
      return createdPosition;
    } catch (error) {
      console.error('❌ Error inserting position:', error);
      throw error;
    }
  }

  /**
   * Update a manual position
   */
  static updateManualPosition(
    positionId: number,
    updates: Partial<Omit<ManualPosition, 'id' | 'createdAt' | 'updatedAt'>>
  ): boolean {
    const db = this.getDatabase();
    
    // If marketPrice is being updated, we need to recalculate market value and unrealized P&L
    if (updates.marketPrice !== undefined) {
      const getStmt = db.prepare('SELECT quantity, average_cost FROM portfolios WHERE id = ?');
      const position = getStmt.get(positionId) as any;
      
      if (position) {
        const marketValue = updates.marketPrice * position.quantity;
        const unrealizedPnl = (updates.marketPrice - position.average_cost) * position.quantity;
        
        // Add calculated values to updates
        updates.marketValue = marketValue;
        updates.unrealizedPnl = unrealizedPnl;
        updates.lastPriceUpdate = new Date().toISOString();
      }
    }
    
    // Map camelCase property names to snake_case database column names
    const fieldMapping: Record<string, string> = {
      mainAccountId: 'main_account_id',
      accountId: 'main_account_id', // Handle both accountId and mainAccountId
      secType: 'sec_type',
      averageCost: 'average_cost',
      primaryExchange: 'primary_exchange',
      marketPrice: 'market_price',
      marketValue: 'market_value',
      dayChange: 'day_change',
      dayChangePercent: 'day_change_percent',
      closePrice: 'close_price',
      unrealizedPnl: 'unrealized_pnl',
      realizedPnl: 'realized_pnl',
      conId: 'con_id',
      source: 'source',
      lastPriceUpdate: 'last_price_update'
    };
    
    const fields: string[] = [];
    const values: any[] = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const dbColumn = fieldMapping[key] || key; // Use mapping or original key for simple fields
      fields.push(`${dbColumn} = ?`);
      values.push(value);
    }
    
    if (fields.length === 0) {
      return false; // No fields to update
    }
    
    const stmt = db.prepare(`
      UPDATE portfolios
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, positionId);
    return result.changes > 0;
  }

  /**
   * Delete a manual position
   */
  static deleteManualPosition(positionId: number): boolean {
    const db = this.getDatabase();
    const stmt = db.prepare('DELETE FROM portfolios WHERE id = ?');
    const result = stmt.run(positionId);
    return result.changes > 0;
  }

  /**
   * Enhanced market data fetching using yahoo-finance2 only
   */
  private static async getEnhancedMarketData(symbol: string): Promise<any> {
    try {
      console.log(`📊 Fetching enhanced data for ${symbol} using yahoo-finance2...`);
      
      const marketData = await YahooFinanceService.getMarketData(symbol);
      
      if (marketData) {
        console.log(`✅ Enhanced data for ${symbol}:`, {
          price: marketData.marketPrice,
          change: marketData.dayChange,
          changePercent: marketData.dayChangePercent?.toFixed(2) + '%'
        });

        return {
          symbol: symbol,
          stockType: "STK",
          country: marketData.country || "N/A",
          sector: marketData.sector || "N/A",
          industry: marketData.industry || "N/A",
          currency: marketData.currency || "USD",
          marketPrice: marketData.marketPrice || 0,
          closePrice: marketData.closePrice || 0,
          dayChange: marketData.dayChange || 0,
          dayChangePercent: marketData.dayChangePercent || 0,
          marketState: marketData.marketState || "UNKNOWN"
        };
      }
      
      console.log(`⚠️ No market data available for ${symbol}, keeping existing data`);
      return null;
      
    } catch (error: any) {
      console.error(`❌ Failed to fetch enhanced data for ${symbol}:`, error?.message || error);
      return null;
    }
  }

  /**
   * Update market data for all manual positions using enhanced yahoo-finance2
   */
  static async updateAllMarketData(userId: string = 'default'): Promise<{ updated: number; failed: number }> {
    const positions = this.getAllManualPositions(userId);
    const symbols = [...new Set(positions.map(p => p.symbol))]; // Remove duplicates
    
    if (symbols.length === 0) {
      return { updated: 0, failed: 0 };
    }

    console.log(`📊 Updating market data for ${symbols.length} symbols using yahoo-finance2...`);
    const startTime = Date.now();
    
    const db = this.getDatabase();
    let updated = 0;
    let failed = 0;

    const updateStmt = db.prepare(`
      UPDATE portfolios
      SET
        market_price = ?,
        market_value = ?,
        day_change = ?,
        day_change_percent = ?,
        close_price = ?,
        unrealized_pnl = ?,
        country = ?,
        industry = ?,
        category = ?,
        last_price_update = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    // Process symbols with rate limiting to avoid 401 errors
    const concurrencyLimit = 2; // Reduced from 5 to avoid rate limiting
    const symbolChunks = [];
    for (let i = 0; i < symbols.length; i += concurrencyLimit) {
      symbolChunks.push(symbols.slice(i, i + concurrencyLimit));
    }

    const marketDataMap = new Map<string, any>();
    
    for (let i = 0; i < symbolChunks.length; i++) {
      const chunk = symbolChunks[i];
      
      if (!chunk || chunk.length === 0) continue;
      
      // Add delay between chunks to avoid rate limiting
      if (i > 0) {
        console.log(`⏱️ Waiting 1s before next batch to avoid rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const chunkPromises = chunk.map((symbol: string) => this.getEnhancedMarketData(symbol));
      const chunkResults = await Promise.all(chunkPromises);
      
      chunkResults.forEach((data, index) => {
        if (data && chunk[index]) {
          marketDataMap.set(chunk[index], data);
        }
      });
    }

    // Update positions with enhanced data
    for (const position of positions) {
      const marketData = marketDataMap.get(position.symbol);
      
      if (marketData && marketData.marketPrice > 0) {
        const marketValue = marketData.marketPrice * position.quantity;
        const unrealizedPnl = (marketData.marketPrice - position.averageCost) * position.quantity;
        const dayChange = marketData.dayChange * position.quantity;
        
        updateStmt.run(
          marketData.marketPrice,
          marketValue,
          dayChange,
          marketData.dayChangePercent,
          marketData.closePrice,
          unrealizedPnl,
          marketData.country,
          marketData.industry,
          marketData.sector, // Use sector as category
          position.id
        );
        
        updated++;
      } else {
        console.log(`❌ Failed to get market data for ${position.symbol}`);
        failed++;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Update last refresh time
    this.lastRefreshTime = Date.now();
    
    console.log(`✅ Updated market data: ${updated} successful, ${failed} failed in ${duration}ms`);
    return { updated, failed };
  }

  /**
   * Update market data for a specific position
   */
  static async updatePositionMarketData(positionId: number): Promise<boolean> {
    const db = this.getDatabase();
    const getStmt = db.prepare('SELECT * FROM portfolios WHERE id = ?');
    const position = getStmt.get(positionId) as ManualPosition;
    
    if (!position) {
      return false;
    }

    const marketData = await YahooFinanceService.getMarketData(position.symbol);
    
    if (!marketData || marketData.marketPrice <= 0) {
      return false;
    }

    const marketValue = marketData.marketPrice * position.quantity;
    const unrealizedPnl = (marketData.marketPrice - position.averageCost) * position.quantity;
    const dayChange = marketData.dayChange * position.quantity;

    const updateStmt = db.prepare(`
      UPDATE portfolios
      SET
        market_price = ?,
        market_value = ?,
        day_change = ?,
        day_change_percent = ?,
        close_price = ?,
        unrealized_pnl = ?,
        country = COALESCE(?, country),
        industry = COALESCE(?, industry),
        category = COALESCE(?, category),
        last_price_update = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = updateStmt.run(
      marketData.marketPrice,
      marketValue,
      dayChange,
      marketData.dayChangePercent,
      marketData.closePrice,
      unrealizedPnl,
      marketData.country || null,
      marketData.industry || null,
      marketData.sector || null, // Use sector as category
      positionId
    );

    return result.changes > 0;
  }

  /**
   * Get enriched positions with Yahoo Finance data
   */
  static async getEnrichedManualPositions(userId: string = 'default'): Promise<ManualPosition[]> {
    const positions = this.getAllManualPositions(userId);
    
    if (positions.length === 0) {
      return [];
    }

    // Update market data first
    await this.updateAllMarketData(userId);
    
    // Get fresh data with market prices
    return this.getAllManualPositions(userId);
  }

  /**
   * Get last refresh timestamp
   */
  static getLastRefreshTime(): number | null {
    return this.lastRefreshTime;
  }

  /**
   * Start auto-refresh timer (30 minutes)
   */
  static startAutoRefresh(userId: string = 'default'): void {
    // Clear existing timer
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    console.log('📊 Starting auto-refresh for manual investments (30 minutes interval)');
    
    this.autoRefreshInterval = setInterval(async () => {
      try {
        console.log('📊 Auto-refreshing manual investment market data...');
        await this.updateAllMarketData(userId);
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
      }
    }, this.AUTO_REFRESH_INTERVAL_MS);
  }

  /**
   * Stop auto-refresh timer
   */
  static stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('📊 Stopped auto-refresh for manual investments');
    }
  }

  /**
   * Get portfolio summary for manual positions
   */
  static getManualPortfolioSummary(userId: string = 'default'): {
    totalValue: number;
    totalCost: number;
    totalUnrealizedPnl: number;
    totalDayChange: number;
    positionCount: number;
    accountCount: number;
  } {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(mp.id) as position_count,
        COUNT(DISTINCT mp.main_account_id) as account_count,
        COALESCE(SUM(mp.market_value), 0) as total_value,
        COALESCE(SUM(mp.average_cost * mp.quantity), 0) as total_cost,
        COALESCE(SUM(mp.unrealized_pnl), 0) as total_unrealized_pnl,
        COALESCE(SUM(mp.day_change), 0) as total_day_change
      FROM portfolios mp
      WHERE mp.source = 'MANUAL'
    `);
    
    const result = stmt.get() as any;
    
    return {
      totalValue: result.total_value || 0,
      totalCost: result.total_cost || 0,
      totalUnrealizedPnl: result.total_unrealized_pnl || 0,
      totalDayChange: result.total_day_change || 0,
      positionCount: result.position_count || 0,
      accountCount: result.account_count || 0
    };
  }
}