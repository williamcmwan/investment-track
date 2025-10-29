-- Migration to add account_number field to accounts table
ALTER TABLE accounts ADD COLUMN account_number TEXT;

-- Create index for account number
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);