-- Migration: 025_video_audience_filters.sql
-- Adiciona filtros de audiência para campanhas de vídeo (Proteção Premium)

ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS min_score_required INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS verified_only BOOLEAN DEFAULT FALSE;

-- Comentários
COMMENT ON COLUMN promo_videos.min_score_required IS 'Score mínimo exigido para o usuário poder assistir e ganhar';
COMMENT ON COLUMN promo_videos.verified_only IS 'Se apenas usuários com selo de verificado podem participar';
