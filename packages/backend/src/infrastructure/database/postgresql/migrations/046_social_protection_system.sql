-- Migration: Social Protection System (Internal Insurance)
-- Adds columns to track mutual protection status and the dedicated fund

-- 1. Updates to users for protection tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS protection_expires_at TIMESTAMPTZ;

-- 2. Updates to system_config for the dedicated fund
ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS mutual_protection_fund DECIMAL(15,2) DEFAULT 0;

-- 3. Comment for legal/compliance clarity
COMMENT COLUMN users.is_protected IS 'Indica se o associado participa do Fundo de Proteção Mútua (Seguro Interno)';
COMMENT COLUMN system_config.mutual_protection_fund IS 'Fundo reservado para coberturas do sistema de Proteção Mútua (Garantia limitada ao saldo do fundo)';
