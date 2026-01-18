-- Migration: Consortium Anti-Default Guard
-- Adds tables and columns for guarantee and insurance management

-- 1. Updates to consortium_members for credit and guarantee tracking
ALTER TABLE consortium_members 
ADD COLUMN IF NOT EXISTS credit_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, BLOCKED
ADD COLUMN IF NOT EXISTS guarantee_description TEXT,
ADD COLUMN IF NOT EXISTS credit_limit_released DECIMAL(15,2) DEFAULT 0;

-- 2. New table for tracking insurances required for contemplation
CREATE TABLE IF NOT EXISTS consortium_member_insurances (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
    insurance_company VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    valid_until DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. New table for member credit documents (RG, CPF, Proof of Income, etc.)
CREATE TABLE IF NOT EXISTS consortium_member_documents (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- RG, CPF, INCOME, GUARANTEE_CONTRACT
    document_url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_member_insurances_member ON consortium_member_insurances(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_member ON consortium_member_documents(member_id);
