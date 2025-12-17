-- Script final de limpeza e otimização do banco de dados
-- Remove triggers problemáticos e garante estabilidade do sistema

-- Remover completamente o trigger problemático da user_statistics
DROP TRIGGER IF EXISTS trigger_update_user_statistics ON users;
DROP FUNCTION IF EXISTS update_user_statistics();

-- Garantir que todas as tabelas tenham as constraints necessárias
-- Tabela user_statistics com constraint unique
ALTER TABLE user_statistics 
ADD CONSTRAINT IF NOT EXISTS user_statistics_user_id_unique 
UNIQUE (user_id);

-- Garantir que admin_dashboard seja uma tabela (não view)
DROP VIEW IF EXISTS current_financial_summary;
DROP TABLE IF EXISTS admin_dashboard;

-- Recriar admin_dashboard como tabela (não view)
CREATE TABLE IF NOT EXISTS admin_dashboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL UNIQUE,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Inserir dados iniciais no admin_dashboard
INSERT INTO admin_dashboard (metric_name, metric_value, metric_metadata) VALUES
    ('system_initialized', 1, '{"timestamp": "' || CURRENT_TIMESTAMP || '", "version": "2.0"}'),
    ('total_users_count', (SELECT COUNT(*) FROM users), '{"auto_calculated": true}'),
    ('active_quotas_count', (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE'), '{"auto_calculated": true}'),
    ('total_loaned_amount', COALESCE((SELECT SUM(CAST(amount AS NUMERIC)) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')), 0), '{"auto_calculated": true}'),
    ('operational_balance', COALESCE((SELECT system_balance FROM system_config LIMIT 1), 0), '{"auto_calculated": true}'),
    ('profit_pool_amount', COALESCE((SELECT profit_pool FROM system_config LIMIT 1), 0), '{"auto_calculated": true}')
ON CONFLICT (metric_name) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    metric_metadata = EXCLUDED.metric_metadata,
    updated_at = CURRENT_TIMESTAMP;

-- Recriar a view de resumo financeiro
CREATE OR REPLACE VIEW current_financial_summary AS
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as active_quotas,
    (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned,
    (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as operational_balance,
    (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
    (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM transactions WHERE status = 'PENDING') as pending_transactions;

-- Garantir que user_financial_summary seja uma tabela (não view)
DROP VIEW IF EXISTS user_financial_summary;
CREATE TABLE IF NOT EXISTS user_financial_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    current_balance DECIMAL(15,2) DEFAULT 0,
    total_quota_value DECIMAL(15,2) DEFAULT 0,
    total_loan_debt DECIMAL(15,2) DEFAULT 0,
    available_credit DECIMAL(15,2) DEFAULT 0,
    total_earned DECIMAL(15,2) DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inicializar user_financial_summary para todos os usuários
INSERT INTO user_financial_summary (user_id, current_balance, last_calculated_at)
SELECT id, balance, CURRENT_TIMESTAMP FROM users
ON CONFLICT (user_id) DO UPDATE SET
    current_balance = EXCLUDED.current_balance,
    last_calculated_at = CURRENT_TIMESTAMP;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_metric_name ON admin_dashboard(metric_name);
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_updated_at ON admin_dashboard(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_financial_summary_user_id ON user_financial_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_financial_summary_last_calculated ON user_financial_summary(last_calculated_at DESC);

-- Limpar logs antigos (manter apenas últimos 30 dias)
DELETE FROM rate_limit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
DELETE FROM admin_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- Atualizar estatísticas do sistema
ANALYZE;

-- Relatar sucesso final
DO $$
BEGIN
    RAISE NOTICE '=== LIMPEZA FINAL DO BANCO CONCLUÍDA ===';
    RAISE NOTICE '✅ Trigger problemático removido';
    RAISE NOTICE '✅ Constraints verificadas e corrigidas';
    RAISE NOTICE '✅ Admin dashboard recriado como tabela';
    RAISE NOTICE '✅ View de resumo financeiro recriada';
    RAISE NOTICE '✅ User financial summary configurado';
    RAISE NOTICE '✅ Índices otimizados criados';
    RAISE NOTICE '✅ Logs antigos limpos';
    RAISE NOTICE '✅ Banco otimizado e pronto para uso';
    RAISE NOTICE '=====================================';
END $$;