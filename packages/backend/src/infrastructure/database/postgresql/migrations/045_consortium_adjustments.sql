-- Migration: Consortium Adjustments & Identifiers
-- Adds group identifier and annual adjustment fields

ALTER TABLE consortium_groups 
ADD COLUMN IF NOT EXISTS group_identifier VARCHAR(20),
ADD COLUMN IF NOT EXISTS annual_adjustment_percent DECIMAL(5,2) DEFAULT 0;

-- Table to track historical adjustments
CREATE TABLE IF NOT EXISTS consortium_adjustment_history (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES consortium_groups(id) ON DELETE CASCADE,
    old_value DECIMAL(15,2) NOT NULL,
    new_value DECIMAL(15,2) NOT NULL,
    adjustment_percent DECIMAL(5,2) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the identifier
CREATE INDEX IF NOT EXISTS idx_consortium_groups_identifier ON consortium_groups(group_identifier);

-- Function to generate the next group identifier (e.g., GRP-001)
-- This is more for documentation as we will handle the logic in the controller
-- but having the column is essential.
