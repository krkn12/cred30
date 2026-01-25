-- Migration: 048_add_quantity_and_variant_to_orders.sql
-- Adiciona colunas quantity e variant_id na tabela marketplace_orders

ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS variant_id INTEGER;

COMMENT ON COLUMN marketplace_orders.quantity IS 'Quantidade de itens comprados';
COMMENT ON COLUMN marketplace_orders.variant_id IS 'ID da variante do produto (tamanho, cor, etc), se aplicável';
