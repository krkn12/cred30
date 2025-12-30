-- Migration: Sistema de Pontos para Ads
-- 1000 pontos = R$ 0,03 (3 centavos)

-- Adicionar campo de pontos de anúncios no usuário
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_points INTEGER DEFAULT 0;

-- Índice para consultas de ranking
CREATE INDEX IF NOT EXISTS idx_users_ad_points ON users(ad_points DESC);

-- Comentário explicativo
COMMENT ON COLUMN users.ad_points IS 'Pontos acumulados por assistir anúncios. 1000 pts = R$ 0,03';
