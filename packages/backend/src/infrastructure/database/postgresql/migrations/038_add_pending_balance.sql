-- Migration: Add pending balance for marketplace settlement
-- This enables the system to hold funds before they become available for withdrawal

ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_balance DECIMAL(15,2) DEFAULT 0;

COMMENT ON COLUMN users.pending_balance IS 'Funds from sales that are in the settlement period (cooling-off) before becoming available in balance.';
