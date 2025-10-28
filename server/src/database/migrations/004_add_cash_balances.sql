-- Migration to add cash balances table
CREATE TABLE IF NOT EXISTS cash_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_account_id INTEGER,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    market_value REAL NOT NULL,
    market_value_usd REAL,
    source TEXT NOT NULL DEFAULT 'IB',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (main_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(main_account_id, currency, source)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cash_balances_account_source ON cash_balances(main_account_id, source);
CREATE INDEX IF NOT EXISTS idx_cash_balances_currency ON cash_balances(currency);