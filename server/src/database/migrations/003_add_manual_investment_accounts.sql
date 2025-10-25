-- Migration: Create unified portfolios table (replaces manual_positions)
-- This table stores both MANUAL and IB-sourced positions linked to main accounts

-- Create portfolios table (references main accounts table)
CREATE TABLE IF NOT EXISTS portfolios (
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
    con_id INTEGER,
    -- Market data fields
    market_price REAL,
    market_value REAL,
    day_change REAL,
    day_change_percent REAL,
    close_price REAL,
    unrealized_pnl REAL,
    realized_pnl REAL,
    -- Metadata
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'MANUAL', -- 'MANUAL' or 'IB'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_price_update DATETIME
    -- Note: We don't add foreign key constraint to main accounts table since it might be in a different database
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_portfolios_main_account_id ON portfolios(main_account_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_symbol ON portfolios(symbol);
CREATE INDEX IF NOT EXISTS idx_portfolios_updated ON portfolios(last_price_update);
CREATE INDEX IF NOT EXISTS idx_portfolios_source ON portfolios(source);