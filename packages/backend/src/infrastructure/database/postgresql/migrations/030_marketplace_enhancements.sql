-- Migration: Marketplace Enhancements (Mercado Livre Features)
-- Data: 2026-01-14

-- 1. MÚLTIPLAS FOTOS: Adicionar coluna images (array de URLs)
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Migrar image_url existente para o array images
UPDATE marketplace_listings 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND (images IS NULL OR images = '{}');

-- 2. LISTA DE DESEJOS (Favoritos)
CREATE TABLE IF NOT EXISTS marketplace_favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON marketplace_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON marketplace_favorites(listing_id);

-- 3. PERGUNTAS E RESPOSTAS
CREATE TABLE IF NOT EXISTS marketplace_questions (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT,
    answered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_questions_listing ON marketplace_questions(listing_id);
CREATE INDEX IF NOT EXISTS idx_questions_user ON marketplace_questions(user_id);

-- 4. AVALIAÇÕES DE VENDEDORES
CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_type VARCHAR(20) NOT NULL DEFAULT 'BUYER_TO_SELLER', -- BUYER_TO_SELLER, SELLER_TO_BUYER
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON marketplace_reviews(reviewed_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON marketplace_reviews(order_id);

-- 5. ESTATÍSTICAS DO VENDEDOR (cache para performance)
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_total_reviews INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_total_sales INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_reputation VARCHAR(20) DEFAULT 'NOVO';

-- 6. CUPONS E OFERTAS
CREATE TABLE IF NOT EXISTS marketplace_coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = cupom global da plataforma
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE', -- PERCENTAGE, FIXED
    discount_value NUMERIC(10,2) NOT NULL,
    min_purchase NUMERIC(10,2) DEFAULT 0,
    max_discount NUMERIC(10,2), -- Limite máximo de desconto (para %)
    usage_limit INTEGER, -- NULL = ilimitado
    usage_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON marketplace_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_seller ON marketplace_coupons(seller_id);

-- 7. FRETE GRÁTIS FLAG
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT FALSE;
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;
