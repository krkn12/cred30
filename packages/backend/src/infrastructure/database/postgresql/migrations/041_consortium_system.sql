-- Migration: Consortium System
-- Creates tables for consortium groups, members, assemblies, bids, and votes

-- Consortium Groups (created by admin)
CREATE TABLE IF NOT EXISTS consortium_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_value DECIMAL(15,2) NOT NULL,
    duration_months INTEGER NOT NULL,
    admin_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
    monthly_installment_value DECIMAL(15,2) NOT NULL,
    start_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, ACTIVE, COMPLETED, CANCELLED
    current_assembly_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consortium Members (users who join a group)
CREATE TABLE IF NOT EXISTS consortium_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES consortium_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CONTEMPLATED, WITHDRAWN
    contemplated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id),
    UNIQUE(group_id, quota_number)
);

-- Consortium Assemblies (monthly meetings for contemplation)
CREATE TABLE IF NOT EXISTS consortium_assemblies (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES consortium_groups(id) ON DELETE CASCADE,
    assembly_number INTEGER NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- YYYY-MM format
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, OPEN_FOR_BIDS, VOTING, FINISHED
    total_pool_collected DECIMAL(15,2) NOT NULL DEFAULT 0,
    winner_member_id INTEGER REFERENCES consortium_members(id),
    winning_bid_amount DECIMAL(15,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    UNIQUE(group_id, assembly_number)
);

-- Consortium Bids (bids placed during assembly)
CREATE TABLE IF NOT EXISTS consortium_bids (
    id SERIAL PRIMARY KEY,
    assembly_id INTEGER NOT NULL REFERENCES consortium_assemblies(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, WINNER, REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assembly_id, member_id)
);

-- Consortium Votes (votes on bids during assembly)
CREATE TABLE IF NOT EXISTS consortium_votes (
    id SERIAL PRIMARY KEY,
    assembly_id INTEGER NOT NULL REFERENCES consortium_assemblies(id) ON DELETE CASCADE,
    voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_bid_id INTEGER NOT NULL REFERENCES consortium_bids(id) ON DELETE CASCADE,
    vote BOOLEAN NOT NULL, -- true = approve, false = reject
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assembly_id, voter_id, target_bid_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consortium_members_group ON consortium_members(group_id);
CREATE INDEX IF NOT EXISTS idx_consortium_members_user ON consortium_members(user_id);
CREATE INDEX IF NOT EXISTS idx_consortium_assemblies_group ON consortium_assemblies(group_id);
CREATE INDEX IF NOT EXISTS idx_consortium_bids_assembly ON consortium_bids(assembly_id);
CREATE INDEX IF NOT EXISTS idx_consortium_votes_assembly ON consortium_votes(assembly_id);
