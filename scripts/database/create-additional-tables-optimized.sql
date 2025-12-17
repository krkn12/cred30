-- Script SQL adicional para criar tabelas otimizadas e garantir índices adequados
-- Baseado na análise completa do frontend e backend do CRED30
-- Este script complementa os scripts anteriores

-- Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = replica;

-- Tabela de sessões de usuário (para controle de sessões ativas)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabela de configurações de notificação do usuário
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    push_notifications BOOLEAN DEFAULT true,
    transaction_alerts BOOLEAN DEFAULT true,
    loan_alerts BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'info', 'success', 'warning', 'error'
    category VARCHAR(50) NOT NULL, -- 'transaction', 'loan', 'quota', 'system'
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de estatísticas do usuário
CREATE TABLE IF NOT EXISTS user_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_earned DECIMAL(15,2) DEFAULT 0,
    total_borrowed DECIMAL(15,2) DEFAULT 0,
    total_repaid DECIMAL(15,2) DEFAULT 0,
    quotas_owned INTEGER DEFAULT 0,
    loans_taken INTEGER DEFAULT 0,
    loans_completed INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de indicações (referrals)
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'expired'
    bonus_amount DECIMAL(10,2) DEFAULT 5.00,
    bonus_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(referrer_id, referred_id)
);

-- Tabela de tickets de suporte
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'general', 'technical', 'financial', 'account'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    assigned_to UUID REFERENCES users(id), -- admin assigned to ticket
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de histórico de taxas
CREATE TABLE IF NOT EXISTS fee_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL, -- 'withdrawal', 'loan_early_payment', etc.
    fee_amount DECIMAL(10,2) NOT NULL,
    fee_percentage DECIMAL(5,4) NOT NULL,
    distribution_rule JSONB, -- how fee was distributed (e.g., {"operational": 0.85, "profit": 0.15})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relatórios diários
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    active_quotas INTEGER DEFAULT 0,
    total_loaned DECIMAL(15,2) DEFAULT 0,
    total_repaid DECIMAL(15,2) DEFAULT 0,
    new_investments DECIMAL(15,2) DEFAULT 0,
    withdrawals_processed DECIMAL(15,2) DEFAULT 0,
    profit_generated DECIMAL(15,2) DEFAULT 0,
    profit_distributed DECIMAL(15,2) DEFAULT 0,
    operational_balance DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de dashboard administrativo (cache de métricas)
CREATE TABLE IF NOT EXISTS admin_dashboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    UNIQUE(metric_name)
);

-- Tabela de resumo financeiro do usuário
CREATE TABLE IF NOT EXISTS user_financial_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_balance DECIMAL(15,2) DEFAULT 0,
    total_quota_value DECIMAL(15,2) DEFAULT 0,
    total_loan_debt DECIMAL(15,2) DEFAULT 0,
    available_credit DECIMAL(15,2) DEFAULT 0,
    total_earned DECIMAL(15,2) DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_last_activity ON user_statistics(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fee_history_transaction_id ON fee_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fee_history_fee_type ON fee_history(fee_type);
CREATE INDEX IF NOT EXISTS idx_fee_history_created_at ON fee_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_dashboard_metric_name ON admin_dashboard(metric_name);
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_updated_at ON admin_dashboard(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_financial_summary_user_id ON user_financial_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_financial_summary_last_calculated ON user_financial_summary(last_calculated_at DESC);

-- Triggers para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_settings_updated_at 
    BEFORE UPDATE ON notification_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_statistics_updated_at 
    BEFORE UPDATE ON user_statistics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers para manter estatísticas atualizadas
CREATE OR REPLACE FUNCTION update_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_statistics (user_id, updated_at)
        VALUES (NEW.id, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE user_statistics SET
            updated_at = CURRENT_TIMESTAMP,
            last_activity_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_user_statistics
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_statistics();

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = DEFAULT;

-- Inserir dados iniciais
INSERT INTO admin_dashboard (metric_name, metric_value, metric_metadata) VALUES
    ('system_initialized', 1, '{"timestamp": "' || CURRENT_TIMESTAMP || '"}'),
    ('last_backup', 0, '{"timestamp": null}'),
    ('total_users_count', 0, '{"auto_calculated": true}'),
    ('active_quotas_count', 0, '{"auto_calculated": true}'),
    ('total_loaned_amount', 0, '{"auto_calculated": true}'),
    ('profit_pool_amount', 0, '{"auto_calculated": true}')
ON CONFLICT (metric_name) DO NOTHING;

-- Criar view para resumo financeiro atualizado
CREATE OR REPLACE VIEW current_financial_summary AS
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as active_quotas,
    (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned,
    (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as operational_balance,
    (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
    (SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) FROM transactions WHERE status = 'PENDING') as pending_transactions;

-- Comentários sobre as tabelas
COMMENT ON TABLE user_sessions IS 'Sessões de usuário ativas e histórico de login';
COMMENT ON TABLE notification_settings IS 'Preferências de notificação do usuário';
COMMENT ON TABLE notifications IS 'Notificações do sistema para usuários';
COMMENT ON TABLE user_statistics IS 'Estatísticas e métricas do usuário';
COMMENT ON TABLE referrals IS 'Sistema de indicações e bônus';
COMMENT ON TABLE support_tickets IS 'Tickets de suporte ao usuário';
COMMENT ON TABLE fee_history IS 'Histórico de taxas cobradas';
COMMENT ON TABLE daily_reports IS 'Relatórios diários do sistema';
COMMENT ON TABLE admin_dashboard IS 'Cache de métricas do dashboard administrativo';
COMMENT ON TABLE user_financial_summary IS 'Resumo financeiro consolidado do usuário';

-- Relatar sucesso
DO $$
BEGIN
    RAISE NOTICE 'Tabelas adicionais criadas com sucesso!';
    RAISE NOTICE 'Total de tabelas criadas: 10 tabelas adicionais';
    RAISE NOTICE 'Índices criados para performance';
    RAISE NOTICE 'Triggers configurados para atualização automática';
    RAISE NOTICE 'Views criadas para consultas otimizadas';
END $$;