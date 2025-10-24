-- Migration: Clean up - Remove unused investment_accounts table
-- Since we're using the main accounts table, we don't need the investment_accounts table

-- Drop the investment_accounts table if it exists (from previous versions)
DROP TABLE IF EXISTS investment_accounts;

-- This migration is mainly for cleanup - the manual_positions table structure 
-- is already correct from migration 003