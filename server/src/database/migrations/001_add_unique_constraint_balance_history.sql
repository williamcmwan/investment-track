-- Migration: Add unique constraint to account_balance_history table
-- This ensures only one entry per date per account

-- First, remove any duplicate entries (keep the latest one for each date)
DELETE FROM account_balance_history 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM account_balance_history 
    GROUP BY account_id, DATE(date)
);

-- Add unique constraint on account_id and date
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balance_history_unique_date 
ON account_balance_history(account_id, DATE(date));
