-- =====================================================
-- CORREÇÃO DA TABELA ADMIN_LOGS - TIPO UUID
-- =====================================================
-- Corrige incompatibilidade de tipos entre UUID e INTEGER
-- =====================================================

-- Remover tabela existente (será recriada com tipo correto)
DROP TABLE IF EXISTS admin_logs CASCADE;

-- Recriar tabela com tipos corretos
CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id UUID REFERENCES users(id), -- Corrigido: UUID em vez de INTEGER
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL,
    entity_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recriar índices para performance
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at);
CREATE INDEX idx_admin_logs_entity ON admin_logs(entity_type, entity_id);

-- Verificação
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'TABELA ADMIN_LOGS CORRIGIDA!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tipo admin_id corrigido para UUID';
    RAISE NOTICE 'Índices recriados com sucesso';
    RAISE NOTICE '===========================================';
END $$;

-- Mostrar estrutura da tabela
\d admin_logs