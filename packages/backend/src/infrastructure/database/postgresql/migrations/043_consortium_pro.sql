-- Migration: Consortium Professionalization
-- Adds governance and risk management columns

-- 1. Updates to consortium_groups
ALTER TABLE consortium_groups 
ADD COLUMN IF NOT EXISTS reserve_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS fixed_bid_percent DECIMAL(5,2) NOT NULL DEFAULT 30.0,
ADD COLUMN IF NOT EXISTS max_embedded_bid_percent DECIMAL(5,2) NOT NULL DEFAULT 30.0,
ADD COLUMN IF NOT EXISTS min_members_to_start INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS current_pool_available DECIMAL(15,2) NOT NULL DEFAULT 0;

-- 2. Updates to consortium_assemblies
ALTER TABLE consortium_assemblies 
ADD COLUMN IF NOT EXISTS draw_number INTEGER,
ADD COLUMN IF NOT EXISTS secondary_draw_number INTEGER; -- For drawing tied fixed bids

-- 3. Updates to consortium_bids
ALTER TABLE consortium_bids 
ADD COLUMN IF NOT EXISTS bid_type VARCHAR(20) NOT NULL DEFAULT 'FREE', -- FREE, FIXED
ADD COLUMN IF NOT EXISTS is_embedded BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS embedded_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- 4. Audit for cancellations
CREATE TABLE IF NOT EXISTS consortium_withdrawals (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES consortium_members(id),
    total_paid_to_pool DECIMAL(15,2) NOT NULL,
    penalty_amount DECIMAL(15,2) NOT NULL,
    refund_amount_due DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, REFUNDED
    refund_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update all existing groups to have pool available equal to current pool
UPDATE consortium_groups SET current_pool_available = current_pool WHERE current_pool_available = 0;
