-- Migration to add account_type field to accounts table
ALTER TABLE accounts ADD COLUMN account_type TEXT DEFAULT 'INVESTMENT';

-- Update existing accounts to be investment accounts
UPDATE accounts SET account_type = 'INVESTMENT' WHERE account_type IS NULL;

-- Create index for account type
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);