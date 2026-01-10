-- Migration: 034_reward_inventory_system.sql

-- Tabela de Catálogo de Recompensas (Dinâmico)
CREATE TABLE IF NOT EXISTS reward_catalog (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- GIFT_CARD, COUPON, MEMBERSHIP
    value DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Estoque de Códigos (Gift Cards)
CREATE TABLE IF NOT EXISTS reward_inventory (
    id SERIAL PRIMARY KEY,
    reward_id VARCHAR(50) REFERENCES reward_catalog(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Redenções (Histórico)
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reward_id VARCHAR(50) REFERENCES reward_catalog(id) ON DELETE NO ACTION,
    reward_name VARCHAR(100),
    points_spent INTEGER NOT NULL,
    code_delivered TEXT,
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Popular dados iniciais baseados no catálogo antigo
INSERT INTO reward_catalog (id, name, points_cost, type, value) VALUES
('gc-amazon-10', 'Gift Card Amazon R$ 10', 1000, 'GIFT_CARD', 10.00),
('gc-ifood-15', 'Cupom iFood R$ 15', 1500, 'COUPON', 15.00),
('gc-spotify-1m', 'Spotify Premium 1 mês', 2000, 'GIFT_CARD', 20.00),
('gc-netflix-25', 'Gift Card Netflix R$ 25', 2500, 'GIFT_CARD', 25.00),
('gc-uber-20', 'Crédito Uber R$ 20', 2000, 'GIFT_CARD', 20.00),
('gc-playstore-30', 'Google Play R$ 30', 3000, 'GIFT_CARD', 30.00),
('gc-recarga-10', 'Recarga Celular R$ 10', 1000, 'GIFT_CARD', 10.00),
('membership-pro-1m', 'PRO 1 Mês', 10000, 'MEMBERSHIP', 29.90)
ON CONFLICT (id) DO NOTHING;
