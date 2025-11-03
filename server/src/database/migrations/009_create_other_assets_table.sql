-- Create other_assets table
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_other_assets_user_id ON other_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_other_assets_asset_type ON other_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_other_assets_created_at ON other_assets(created_at);