Database Schema

This document summarizes the current SQLite schema for `server/data/investment_tracker.db`, generated from the live `.schema` output.

Overview
- Engine: SQLite
- Managed by TypeScript migrations in `server/src/database`
- Conventions:
  - Primary keys: `INTEGER PRIMARY KEY AUTOINCREMENT`
  - Timestamps default to `CURRENT_TIMESTAMP`
  - Booleans stored as integers (0/1)

Tables

users
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `email` TEXT UNIQUE NOT NULL
  - `password_hash` TEXT NOT NULL
  - `name` TEXT NOT NULL
  - `base_currency` TEXT DEFAULT 'HKD'
  - `two_factor_secret` TEXT
  - `two_factor_enabled` BOOLEAN DEFAULT FALSE
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - UNIQUE(`email`)

accounts
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `user_id` INTEGER NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE
  - `name` TEXT NOT NULL
  - `currency` TEXT NOT NULL
  - `original_capital` REAL NOT NULL
  - `current_balance` REAL NOT NULL
  - `last_updated` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - INDEX `idx_accounts_user_id` ON (`user_id`)

account_balance_history
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `account_id` INTEGER NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE
  - `balance` REAL NOT NULL
  - `note` TEXT
  - `date` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - INDEX `idx_account_balance_history_account_id` ON (`account_id`)
  - UNIQUE INDEX `idx_account_balance_history_unique_date` ON (`account_id`, DATE(`date`))

currency_pairs
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `user_id` INTEGER NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE
  - `pair` TEXT NOT NULL
  - `current_rate` REAL NOT NULL
  - `avg_cost` REAL NOT NULL
  - `amount` REAL NOT NULL
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - INDEX `idx_currency_pairs_user_id` ON (`user_id`)

performance_history
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `user_id` INTEGER NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE
  - `date` DATE NOT NULL
  - `total_pl` REAL NOT NULL
  - `investment_pl` REAL NOT NULL
  - `currency_pl` REAL NOT NULL
  - `daily_pl` REAL NOT NULL
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - UNIQUE(`user_id`, `date`)
  - INDEX `idx_performance_history_user_id` ON (`user_id`)
  - INDEX `idx_performance_history_date` ON (`date`)

exchange_rates
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `pair` TEXT NOT NULL
  - `rate` REAL NOT NULL
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- Indexes/Constraints:
  - UNIQUE(`pair`)
  - INDEX `idx_exchange_rates_pair` ON (`pair`)

ib_connections
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `user_id` INTEGER NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE
  - `name` TEXT NOT NULL
  - `host` TEXT NOT NULL
  - `port` INTEGER NOT NULL
  - `client_id` INTEGER NOT NULL
  - `is_connected` BOOLEAN DEFAULT FALSE
  - `last_connected` DATETIME
  - `account_balance` REAL
  - `account_currency` TEXT
  - `error` TEXT
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `target_account_id` INTEGER REFERENCES `accounts`(`id`) ON DELETE SET NULL
- Indexes/Constraints:
  - UNIQUE(`user_id`, `client_id`)
  - INDEX `idx_ib_connections_user_id` ON (`user_id`)

portfolios
- Columns:
  - `id` INTEGER PK AUTOINCREMENT
  - `main_account_id` INTEGER NOT NULL
  - `symbol` TEXT NOT NULL
  - `sec_type` TEXT NOT NULL — e.g. 'STK', 'BOND', 'CRYPTO', 'ETF', 'MUTUAL_FUND'
  - `currency` TEXT NOT NULL DEFAULT 'USD'
  - `country` TEXT
  - `industry` TEXT
  - `category` TEXT
  - `quantity` REAL NOT NULL
  - `average_cost` REAL NOT NULL
  - `exchange` TEXT
  - `primary_exchange` TEXT
  - `con_id` INTEGER
  - `market_price` REAL
  - `market_value` REAL
  - `day_change` REAL
  - `day_change_percent` REAL
  - `close_price` REAL
  - `unrealized_pnl` REAL
  - `realized_pnl` REAL
  - `notes` TEXT
  - `source` TEXT NOT NULL DEFAULT 'MANUAL' — 'MANUAL' or 'IB'
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `last_price_update` DATETIME
- Indexes/Constraints:
  - INDEX `idx_portfolios_main_account_id` ON (`main_account_id`)
  - INDEX `idx_portfolios_symbol` ON (`symbol`)
  - INDEX `idx_portfolios_updated` ON (`last_price_update`)
  - INDEX `idx_portfolios_source` ON (`source`)
- Notes:
  - No foreign key is enforced for `main_account_id` (may reference an external or different DB).

Relationships Summary
- `accounts.user_id` → `users.id` (ON DELETE CASCADE)
- `account_balance_history.account_id` → `accounts.id` (ON DELETE CASCADE)
- `currency_pairs.user_id` → `users.id` (ON DELETE CASCADE)
- `performance_history.user_id` → `users.id` (ON DELETE CASCADE)
- `ib_connections.user_id` → `users.id` (ON DELETE CASCADE)
- `ib_connections.target_account_id` → `accounts.id` (ON DELETE SET NULL)
- `portfolios.main_account_id` has no enforced FK

Notes
- Balance day uniqueness enforced via `idx_account_balance_history_unique_date` using `DATE(date)`.
- Most `updated_at` columns are application-managed (no DB triggers).
- Boolean columns are represented as INTEGER 0/1 in SQLite.

Generated from live `.schema` output to reflect the current database state.
