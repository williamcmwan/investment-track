-- Investment Tracker Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  base_currency TEXT DEFAULT 'HKD',
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Investment accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    account_type TEXT DEFAULT 'INVESTMENT',
    account_number TEXT,
    original_capital REAL NOT NULL,
    current_balance REAL NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Account balance history table
CREATE TABLE IF NOT EXISTS account_balance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    balance REAL NOT NULL,
    note TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Currency pairs table
CREATE TABLE IF NOT EXISTS currency_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pair TEXT NOT NULL,
    current_rate REAL NOT NULL,
    avg_cost REAL NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance history table
CREATE TABLE IF NOT EXISTS performance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_pl REAL NOT NULL,
    investment_pl REAL NOT NULL,
    currency_pl REAL NOT NULL,
    daily_pl REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

-- Exchange rates table (for caching external API data)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    rate REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pair)
);

-- Interactive Brokers connections table
CREATE TABLE IF NOT EXISTS ib_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    target_account_id INTEGER,
    is_connected BOOLEAN DEFAULT FALSE,
    last_connected DATETIME,
    account_balance REAL,
    account_currency TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    UNIQUE(user_id, client_id)
);

-- Other assets table (real estate, collectibles, etc.)
CREATE TABLE IF NOT EXISTS other_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  asset TEXT NOT NULL,
  currency TEXT NOT NULL,
  original_value REAL NOT NULL DEFAULT 0,
  market_value REAL NOT NULL DEFAULT 0,
  remarks TEXT DEFAULT '',
  created_at DATETIME DEFAULT (datetime('now', 'localtime')),
  updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Charles Schwab settings table
CREATE TABLE IF NOT EXISTS schwab_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  app_key TEXT NOT NULL,
  app_secret TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balance_history_account_id ON account_balance_history(account_id);
CREATE INDEX IF NOT EXISTS idx_currency_pairs_user_id ON currency_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_user_id ON performance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_date ON performance_history(date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(pair);
CREATE INDEX IF NOT EXISTS idx_ib_connections_user_id ON ib_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_other_assets_user_id ON other_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_other_assets_asset_type ON other_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_other_assets_created_at ON other_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_schwab_settings_user_id ON schwab_settings(user_id);
