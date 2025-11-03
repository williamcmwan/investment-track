-- Migration to add last_updates table for tracking data refresh times
CREATE TABLE IF NOT EXISTS last_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_account_id INTEGER,
    update_type TEXT NOT NULL, -- 'IB_PORTFOLIO', 'MANUAL_PORTFOLIO', 'EXCHANGE_RATES', etc.
    last_updated DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (main_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(main_account_id, update_type)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_last_updates_account_type ON last_updates(main_account_id, update_type);
CREATE INDEX IF NOT EXISTS idx_last_updates_type ON last_updates(update_type);