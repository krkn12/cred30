-- Migration: Add status and sale details to investments
-- Date: 2026-01-04

ALTER TABLE investments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS sale_value DECIMAL(15,2);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;

-- Marcar todos os atuais como ACTIVE (caso já existam dados)
UPDATE investments SET status = 'ACTIVE' WHERE status IS NULL;
