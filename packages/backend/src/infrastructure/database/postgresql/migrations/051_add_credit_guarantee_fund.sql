-- Adiciona o Fundo de Garantia de Crédito (FGC-Cred30) para cobrir inadimplência
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS credit_guarantee_fund NUMERIC(15, 2) DEFAULT 0.00;
COMMENT ON COLUMN system_config.credit_guarantee_fund IS 'Fundo alimentado por taxas de proteção de crédito para cobrir inadimplência';
