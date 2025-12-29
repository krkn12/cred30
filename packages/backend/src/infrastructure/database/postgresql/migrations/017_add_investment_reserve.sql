-- Migration: Add investment reserve column for building solid patrimony
-- Date: 2024-12-28
-- Purpose: Track funds reserved for long-term investments (stocks, FIIs, bonds)

ALTER TABLE system_config ADD COLUMN IF NOT EXISTS investment_reserve DECIMAL(20,2) DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN system_config.investment_reserve IS 'Fundo para investimentos em patrimônio sólido (ações, FIIs, títulos)';
