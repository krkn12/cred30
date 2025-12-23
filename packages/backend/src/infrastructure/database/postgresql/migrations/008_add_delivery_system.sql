ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES users(id);
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'NONE'; -- NONE, AVAILABLE, ACCEPTED, IN_TRANSIT, DELIVERED
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10);
-- delivery_code usaremos o offline_token que já existe, ou criaremos um padronizado depois
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS courier_rating INT CHECK (courier_rating >= 1 AND courier_rating <= 5);

CREATE INDEX idx_marketplace_orders_delivery_status ON marketplace_orders(delivery_status) WHERE delivery_status != 'NONE';
