-- Migration: 027_full_social_audit.sql
-- Expandir auditoria para comentários e inscritos

ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_initial_comments INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_current_comments INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_initial_subscribers INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_current_subscribers INTEGER DEFAULT 0;

-- Comentários
COMMENT ON COLUMN promo_videos.external_initial_comments IS 'Quantidade de comentários no vídeo ao iniciar a campanha';
COMMENT ON COLUMN promo_videos.external_initial_subscribers IS 'Quantidade de inscritos no canal ao iniciar a campanha';
