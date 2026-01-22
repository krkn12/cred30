-- Migration: 048_pdv_system.sql
-- Sistema de PDV (Ponto de Venda) para Comerciantes

-- Tabela de Cobranças PDV
CREATE TABLE IF NOT EXISTS pdv_charges (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    confirmation_code VARCHAR(6) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, EXPIRED, CANCELLED
    fee_amount DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pdv_charges_merchant ON pdv_charges(merchant_id);
CREATE INDEX IF NOT EXISTS idx_pdv_charges_customer ON pdv_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_pdv_charges_code ON pdv_charges(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_pdv_charges_status ON pdv_charges(status);
CREATE INDEX IF NOT EXISTS idx_pdv_charges_expires ON pdv_charges(expires_at) WHERE status = 'PENDING';

-- Flag para identificar usuários comerciantes
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS merchant_since TIMESTAMP WITH TIME ZONE;
