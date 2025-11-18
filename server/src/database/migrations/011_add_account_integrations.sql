-- Add integration fields to accounts table
ALTER TABLE accounts ADD COLUMN integration_type TEXT DEFAULT NULL; -- 'IB', 'SCHWAB', or NULL
ALTER TABLE accounts ADD COLUMN integration_config TEXT DEFAULT NULL; -- JSON config for the integration

-- For IB: { "host": "localhost", "port": 4001, "client_id": 1 }
-- For Schwab: { "app_key": "...", "app_secret": "...", "access_token": "...", "refresh_token": "...", "token_expires_at": 123456 }

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_integration_type ON accounts(integration_type);

-- Note: Existing ib_connections and schwab_settings tables will be deprecated
-- but kept for backward compatibility during migration
