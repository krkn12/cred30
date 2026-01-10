-- Migração para suporte a Lotes (Agrupamento de Itens) no Marketplace
-- Adiciona suporte para múltiplos itens em um único pedido/missão logística

ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS listing_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_lote BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN marketplace_orders.listing_ids IS 'Array de IDs de anúncios incluídos neste pedido (Lote)';
COMMENT ON COLUMN marketplace_orders.is_lote IS 'Indica se o pedido contém múltiplos itens do mesmo vendedor';
