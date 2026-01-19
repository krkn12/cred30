-- Migração: Adição de índices críticos para performance
-- Sistema: Cred30

-- 1. Marketplace
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_status ON marketplace_listings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);

-- 2. Transações
CREATE INDEX IF NOT EXISTS idx_transactions_type_created ON transactions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_id);

-- 3. Saques (Withdrawals)
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);

-- 4. Marketplace Orders
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_id ON marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status);

-- 5. Logistics / Entregas
CREATE INDEX IF NOT EXISTS idx_logistics_deliveries_courier_id ON logistics_deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_logistics_deliveries_status ON logistics_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_logistics_deliveries_order_id ON logistics_deliveries(order_id);

-- 6. Usuários (Busca por código de indicação)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 7. Cotas
CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
