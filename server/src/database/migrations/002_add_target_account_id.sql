-- Migration: Add target_account_id column to ib_connections table
-- Date: 2025-10-24
-- Description: Allows users to specify which investment account should be updated with IB portfolio data

-- Check if column exists before adding (SQLite doesn't have IF NOT EXISTS for ALTER TABLE)
-- This is safe to run multiple times

ALTER TABLE ib_connections ADD COLUMN target_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;