-- Adiciona o pote de investimento corporativo (Equity/Empresas)
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS total_corporate_investment_reserve NUMERIC(15, 2) DEFAULT 0.00;
COMMENT ON COLUMN system_config.total_corporate_investment_reserve IS 'Pote para investir em empresas parceiras pelo ADM';
