-- Migration: Create investments tracking table
-- Date: 2024-12-28
-- Purpose: Track investments made with the investment_reserve fund

CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    asset_name VARCHAR(100) NOT NULL,           -- Nome do ativo (ex: "ITSA4", "MXRF11", "Tesouro IPCA+ 2029")
    asset_type VARCHAR(50) NOT NULL,             -- Tipo: STOCK, FII, BOND, ETF, OTHER
    quantity DECIMAL(15,6) DEFAULT 0,            -- Quantidade (ações, cotas, etc)
    unit_price DECIMAL(15,2) NOT NULL,           -- Preço unitário na compra
    total_invested DECIMAL(15,2) NOT NULL,       -- Valor total investido
    current_value DECIMAL(15,2) DEFAULT 0,       -- Valor atual estimado (atualizado manualmente)
    dividends_received DECIMAL(15,2) DEFAULT 0,  -- Total de dividendos recebidos
    broker VARCHAR(100),                          -- Corretora utilizada
    notes TEXT,                                   -- Observações
    invested_at TIMESTAMP DEFAULT NOW(),         -- Data do investimento
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_investments_asset_type ON investments(asset_type);
CREATE INDEX IF NOT EXISTS idx_investments_invested_at ON investments(invested_at);
