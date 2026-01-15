-- Migration: Consortium Pool System
-- Adds pool accumulation and payment tracking

-- Add current_pool to track accumulated funds in each group
ALTER TABLE consortium_groups ADD COLUMN IF NOT EXISTS current_pool DECIMAL(15,2) DEFAULT 0;

-- Add payment tracking to members
ALTER TABLE consortium_members ADD COLUMN IF NOT EXISTS paid_installments INTEGER DEFAULT 1;
ALTER TABLE consortium_members ADD COLUMN IF NOT EXISTS next_due_date DATE;
ALTER TABLE consortium_members ADD COLUMN IF NOT EXISTS total_paid DECIMAL(15,2) DEFAULT 0;

-- Add total_collected to assemblies for historical tracking
ALTER TABLE consortium_assemblies ADD COLUMN IF NOT EXISTS contemplation_value DECIMAL(15,2);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_consortium_members_due_date ON consortium_members(next_due_date);
