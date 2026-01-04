-- Migration: 024_video_engagement_missions.sql
-- Adiciona suporte para missões de engajamento social (likes, comentários, inscritos)

-- Adicionar colunas na tabela de vídeos
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS require_like BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS require_comment BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS require_subscribe BOOLEAN DEFAULT FALSE;

-- Adicionar colunas na tabela de views para registrar o que foi feito
ALTER TABLE promo_video_views ADD COLUMN IF NOT EXISTS liked BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_video_views ADD COLUMN IF NOT EXISTS commented BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_video_views ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT FALSE;

-- Comentários
COMMENT ON COLUMN promo_videos.require_like IS 'Se a campanha incentiva curtidas no vídeo';
COMMENT ON COLUMN promo_videos.require_comment IS 'Se a campanha incentiva comentários no vídeo';
COMMENT ON COLUMN promo_videos.require_subscribe IS 'Se a campanha incentiva inscrições no canal';

COMMENT ON COLUMN promo_video_views.liked IS 'Se o usuário clicou para curtir';
COMMENT ON COLUMN promo_video_views.commented IS 'Se o usuário clicou para comentar';
COMMENT ON COLUMN promo_video_views.subscribed IS 'Se o usuário clicou para se inscrever';
