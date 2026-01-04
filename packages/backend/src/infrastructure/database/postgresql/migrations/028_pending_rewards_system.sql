-- Migration: 028_pending_rewards_system.sql
-- Adiciona suporte para saldo pendente de auditoria em missões de vídeo

ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_video_points INTEGER DEFAULT 0;

-- Tabela para rastrear bônus de missões específicas aguardando liberação
CREATE TABLE IF NOT EXISTS pending_mission_rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES promo_videos(id) ON DELETE CASCADE,
    view_id INTEGER REFERENCES promo_video_views(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Índices e comentários
CREATE INDEX IF NOT EXISTS idx_pending_mission_user ON pending_mission_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_mission_video ON pending_mission_rewards(video_id, status);

COMMENT ON COLUMN users.pending_video_points IS 'Pontos de missões sociais aguardando auditoria estatística';
