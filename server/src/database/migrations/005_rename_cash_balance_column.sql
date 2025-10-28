-- Migration to rename market_value to market_value_hkd in cash_balances table
ALTER TABLE cash_balances RENAME COLUMN market_value TO market_value_hkd;