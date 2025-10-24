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