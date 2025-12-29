-- Migration: 021_education_security.sql
-- Adiciona rastreamento de sessões de estudo para evitar fraudes na Academia

CREATE TABLE IF NOT EXISTS education_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_seconds INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Anti-cheat
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_edu_sessions_user ON education_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_edu_sessions_active ON education_sessions(user_id, is_active) WHERE is_active = TRUE;

-- Comentários
COMMENT ON TABLE education_sessions IS 'Rastreia sessões de estudo em tempo real para validar recompensas';
