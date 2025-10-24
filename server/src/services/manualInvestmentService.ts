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
  // Market data (from Yahoo Finance)
  marketPrice?: number;
  marketValue?: number;
  dayChange?: number;
  dayChangePercent?: number;
  closePrice?: number;
  unrealizedPnl?: number;
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastPriceUpdate?: string;
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
      marketPrice: row.market_price,
      marketValue: row.market_value,
      dayChange: row.day_change,
      dayChangePercent: row.day_change_percent,
      closePrice: row.close_price,
      unrealizedPnl: row.unrealized_pnl,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastPriceUpdate: row.last_price_update
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
      // Migration 003: Create manual positions table
      console.log('📊 Running migration 003: Create manual positions table');
      const migration003 = `
        -- Migration: Add manual positions table
        -- This allows users to manually add investment positions linked to their main accounts

        -- Create manual positions table (references main accounts table)
        CREATE TABLE IF NOT EXISTS manual_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            main_account_id INTEGER NOT NULL, -- References the main accounts table
            symbol TEXT NOT NULL,
            sec_type TEXT NOT NULL, -- 'STK', 'BOND', 'CRYPTO', 'ETF', 'MUTUAL_FUND', etc.
            currency TEXT NOT NULL DEFAULT 'USD',
            country TEXT,
            industry TEXT,
            category TEXT,
            quantity REAL NOT NULL,
            average_cost REAL NOT NULL,
            exchange TEXT,
            primary_exchange TEXT,
            -- Yahoo Finance data (auto-populated)
            market_price REAL,
            market_value REAL,
            day_change REAL,
            day_change_percent REAL,
            close_price REAL,
            unrealized_pnl REAL,
            -- Metadata
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_price_update DATETIME
            -- Note: We don't add foreign key constraint to main accounts table since it might be in a different database
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_manual_positions_main_account_id ON manual_positions(main_account_id);
        CREATE INDEX IF NOT EXISTS idx_manual_positions_symbol ON manual_positions(symbol);
        CREATE INDEX IF NOT EXISTS idx_manual_positions_updated ON manual_positions(last_price_update);
      `;
      
      db.exec(migration003);
      console.log('✅ Migration 003 completed');

      // Migration 004: Cleanup unused tables
      console.log('📊 Running migration 004: Cleanup unused tables');
      const migration004 = `
        -- Migration: Clean up - Remove unused investment_accounts table
        -- Since we're using the main accounts table, we don't need the investment_accounts table

        -- Drop the investment_accounts table if it exists (from previous versions)
        DROP TABLE IF EXISTS investment_accounts;
      `;
      
      db.exec(migration004);
      console.log('✅ Migration 004 completed');
      
    } catch (error) {
      console.error('❌ Error running migrations:', error);
    }
    
    console.log('✅ Manual investment accounts database initialized');
  }



  /**
   * Get all manual positions for a main account
   */
  static getManualPositions(mainAccountId: number): ManualPosition[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM manual_positions 
      WHERE main_account_id = ? 
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
      SELECT * FROM manual_positions 
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
      INSERT INTO manual_positions (
        main_account_id, symbol, sec_type, currency, country, industry, category,
        quantity, average_cost, exchange, primary_exchange, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        position.notes
      );
      
      console.log('✅ Position inserted with ID:', result.lastInsertRowid);
      
      // Return the created position
      const getStmt = db.prepare('SELECT * FROM manual_positions WHERE id = ?');
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
      UPDATE manual_positions 
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
    const stmt = db.prepare('DELETE FROM manual_positions WHERE id = ?');
    const result = stmt.run(positionId);
    return result.changes > 0;
  }

  /**
   * Update market data for all manual positions using Yahoo Finance
   */
  static async updateAllMarketData(userId: string = 'default'): Promise<{ updated: number; failed: number }> {
    const positions = this.getAllManualPositions(userId);
    const symbols = [...new Set(positions.map(p => p.symbol))]; // Remove duplicates
    
    if (symbols.length === 0) {
      return { updated: 0, failed: 0 };
    }

    console.log(`📊 Updating market data for ${symbols.length} symbols...`);
    
    const marketDataMap = await YahooFinanceService.getMultipleMarketData(symbols);
    const db = this.getDatabase();
    
    let updated = 0;
    let failed = 0;

    const updateStmt = db.prepare(`
      UPDATE manual_positions 
      SET 
        market_price = ?,
        market_value = ?,
        day_change = ?,
        day_change_percent = ?,
        close_price = ?,
        unrealized_pnl = ?,
        last_price_update = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

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
          position.id
        );
        
        updated++;
      } else {
        console.log(`❌ Failed to get market data for ${position.symbol}`);
        failed++;
      }
    }

    console.log(`✅ Updated market data: ${updated} successful, ${failed} failed`);
    return { updated, failed };
  }

  /**
   * Update market data for a specific position
   */
  static async updatePositionMarketData(positionId: number): Promise<boolean> {
    const db = this.getDatabase();
    const getStmt = db.prepare('SELECT * FROM manual_positions WHERE id = ?');
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
      UPDATE manual_positions 
      SET 
        market_price = ?,
        market_value = ?,
        day_change = ?,
        day_change_percent = ?,
        close_price = ?,
        unrealized_pnl = ?,
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
      FROM manual_positions mp
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