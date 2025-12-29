-- Migration: Add seller/vendor account fields for Asaas split payments
-- For marketplace vendors to receive payments directly via Asaas subaccounts

-- Add seller fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS asaas_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS asaas_wallet_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS seller_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS seller_company_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS seller_cpf_cnpj VARCHAR(20),
ADD COLUMN IF NOT EXISTS seller_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS seller_address_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS seller_address_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS seller_address_neighborhood VARCHAR(100),
ADD COLUMN IF NOT EXISTS seller_address_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS seller_address_state VARCHAR(2),
ADD COLUMN IF NOT EXISTS seller_address_postal_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS seller_created_at TIMESTAMP;

-- Index for faster seller lookups
CREATE INDEX IF NOT EXISTS idx_users_is_seller ON users(is_seller) WHERE is_seller = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_asaas_wallet ON users(asaas_wallet_id) WHERE asaas_wallet_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN users.asaas_account_id IS 'Asaas subaccount ID for seller';
COMMENT ON COLUMN users.asaas_wallet_id IS 'Asaas wallet ID for split payments';
COMMENT ON COLUMN users.is_seller IS 'Whether user is a marketplace seller';
COMMENT ON COLUMN users.seller_status IS 'Seller status: pending, approved, rejected';
