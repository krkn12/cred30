-- Migration: 047_add_stock_column_to_listings.sql
-- Adiciona a coluna stock na tabela marketplace_listings se não existir

ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;
