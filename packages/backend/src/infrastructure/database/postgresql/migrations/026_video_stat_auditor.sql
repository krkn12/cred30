-- Migration: 026_video_stat_auditor.sql
-- Adiciona rastreamento de métricas externas para auditoria estatística

ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_initial_likes INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS external_current_likes INTEGER DEFAULT 0;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS last_audit_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE promo_videos ADD COLUMN IF NOT EXISTS audit_health_score DECIMAL(5,2) DEFAULT 100.00;

-- Tabela para log de auditoria
CREATE TABLE IF NOT EXISTS promo_video_audits (
    id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES promo_videos(id) ON DELETE CASCADE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes_start INTEGER,
    likes_now INTEGER,
    clicks_recorded INTEGER,
    conversion_rate DECIMAL(5,2),
    status VARCHAR(20) -- HEALTHY, WARNING, CRITICAL
);

-- Comentários
COMMENT ON COLUMN promo_videos.audit_health_score IS 'Percentual de confiança da campanha (Cliques no App vs Likes Reais no YouTube)';
