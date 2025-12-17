-- Script para criar tabelas faltantes no banco de dados CRED30
-- Baseado na análise do frontend e backend

-- ========================================
-- TABELAS PRINCIPAIS DO SISTEMA
-- ========================================

-- Tabela de usuários (já existe, mas vamos garantir estrutura completa)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pix_key VARCHAR(255),
    secret_phrase VARCHAR(255) UNIQUE NOT NULL,
    balance NUMERIC(15,2) DEFAULT 0.00,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    referred_by VARCHAR(50) REFERENCES users(referral_code),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações do sistema (já existe, mas vamos garantir)
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    system_balance NUMERIC(15,2) DEFAULT 0.00,
    profit_pool NUMERIC(15,2) DEFAULT 0.00,
    quota_price NUMERIC(10,2) DEFAULT 50.00,
    loan_interest_rate NUMERIC(5,4) DEFAULT 0.2000,
    penalty_rate NUMERIC(5,4) DEFAULT 0.4000,
    vesting_period_ms BIGINT DEFAULT 31536000000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de cotas (já existe, mas vamos garantir estrutura completa)
CREATE TABLE IF NOT EXISTS quotas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purchase_price NUMERIC(10,2) NOT NULL,
    current_value NUMERIC(10,2) NOT NULL,
    purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOLD', 'EXPIRED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de empréstimos (já existe, mas vamos garantir estrutura completa)
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    total_repayment NUMERIC(15,2) NOT NULL,
    installments INTEGER NOT NULL,
    interest_rate NUMERIC(5,4) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'PAYMENT_PENDING')),
    due_date TIMESTAMP NOT NULL,
    pix_key_to_receive VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de parcelas de empréstimos
CREATE TABLE IF NOT EXISTS loan_installments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    use_balance BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de transações (já existe, mas vamos garantir estrutura completa)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'BUY_QUOTA', 'SELL_QUOTA', 'LOAN_PAYMENT', 'WITHDRAWAL', 
        'DEPOSIT', 'LOAN_APPROVED', 'REFERRAL_BONUS', 'DIVIDEND'
    )),
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE AUDITORIA E LOGS
-- ========================================

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    entity_type VARCHAR(50),
    details JSONB,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de sessões de usuário
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- ========================================
-- TABELAS DE SISTEMA E CONFIGURAÇÕES
-- ========================================

-- Tabela de configurações de notificações
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO' CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações do sistema (extensão)
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE RELATÓRIOS E ESTATÍSTICAS
-- ========================================

-- Tabela de relatórios diários
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE UNIQUE NOT NULL,
    total_users INTEGER DEFAULT 0,
    active_quotas INTEGER DEFAULT 0,
    total_loaned NUMERIC(15,2) DEFAULT 0.00,
    total_received NUMERIC(15,2) DEFAULT 0.00,
    profit_pool NUMERIC(15,2) DEFAULT 0.00,
    system_balance NUMERIC(15,2) DEFAULT 0.00,
    new_users INTEGER DEFAULT 0,
    loans_approved INTEGER DEFAULT 0,
    loans_rejected INTEGER DEFAULT 0,
    quotas_sold INTEGER DEFAULT 0,
    quotas_bought INTEGER DEFAULT 0,
    withdrawals_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de estatísticas de usuário
CREATE TABLE IF NOT EXISTS user_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_invested NUMERIC(15,2) DEFAULT 0.00,
    total_withdrawn NUMERIC(15,2) DEFAULT 0.00,
    total_borrowed NUMERIC(15,2) DEFAULT 0.00,
    total_repaid NUMERIC(15,2) DEFAULT 0.00,
    quotas_owned INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE INDICAÇÕES E BÔNUS
-- ========================================

-- Tabela de indicações
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REWARDED')),
    bonus_amount NUMERIC(10,2) DEFAULT 0.00,
    rewarded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
);

-- Tabela de bônus de indicação
CREATE TABLE IF NOT EXISTS referral_bonuses (
    id SERIAL PRIMARY KEY,
    referral_id INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    type VARCHAR(50) DEFAULT 'SIGNUP' CHECK (type IN ('SIGNUP', 'FIRST_INVESTMENT', 'FIRST_LOAN')),
    transaction_id INTEGER REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE TAXAS E CONFIGURAÇÕES FINANCEIRAS
-- ========================================

-- Tabela de taxas do sistema
CREATE TABLE IF NOT EXISTS system_fees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('WITHDRAWAL', 'LOAN', 'TRANSFER', 'PENALTY')),
    fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('PERCENTAGE', 'FIXED', 'HYBRID')),
    fee_value NUMERIC(10,4) NOT NULL,
    min_fee NUMERIC(10,2) DEFAULT 0.00,
    max_fee NUMERIC(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de taxas
CREATE TABLE IF NOT EXISTS fee_history (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL,
    fee_amount NUMERIC(10,2) NOT NULL,
    fee_distribution JSONB, -- Ex: {"operational": 85, "profit": 15}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE SUPORTE E HELP DESK
-- ========================================

-- Tabela de tickets de suporte
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'CLOSED', 'RESOLVED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    category VARCHAR(50),
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de respostas de suporte
CREATE TABLE IF NOT EXISTS support_responses (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELAS DE BACKUP E RECUPERAÇÃO
-- ========================================

-- Tabela de logs de backup
CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('FULL', 'INCREMENTAL', 'DIFFERENTIAL')),
    file_path TEXT,
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'STARTED' CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED')),
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ========================================
-- ÍNDICES PARA MELHORAR PERFORMANCE
-- ========================================

-- Índices para tabela de usuários
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Índices para tabela de cotas
CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_status ON quotas(status);
CREATE INDEX IF NOT EXISTS idx_quotas_purchase_date ON quotas(purchase_date);

-- Índices para tabela de empréstimos
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_created_at ON loans(created_at);

-- Índices para tabela de parcelas
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan_id ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_created_at ON loan_installments(created_at);

-- Índices para tabela de transações
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status ON transactions(user_id, type, status);

-- Índices para tabela de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_by ON audit_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Índices para tabela de sessões
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Índices para tabela de notificações
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Índices para tabela de indicações
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Índices para tabela de relatórios diários
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date);

-- Índices para tabela de estatísticas de usuário
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_last_activity ON user_statistics(last_activity);

-- Índices para tabela de tickets de suporte
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- ========================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ========================================

-- Trigger para atualizar updated_at em tabelas principais
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger às tabelas que precisam
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotas_updated_at BEFORE UPDATE ON quotas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_statistics_updated_at BEFORE UPDATE ON user_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_fees_updated_at BEFORE UPDATE ON system_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- INSERÇÃO DE DADOS INICIAIS
-- ========================================

-- Inserir configurações padrão do sistema se não existirem
INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
VALUES (0.00, 0.00, 50.00, 0.2000, 0.4000, 31536000000)
ON CONFLICT DO NOTHING;

-- Inserir taxas padrão do sistema
INSERT INTO system_fees (name, type, fee_type, fee_value, min_fee)
VALUES 
    ('Taxa de Saque', 'WITHDRAWAL', 'HYBRID', 0.02, 5.00),
    ('Taxa de Empréstimo', 'LOAN', 'PERCENTAGE', 0.20, 0.00),
    ('Multa de Resgate Antecipado', 'PENALTY', 'PERCENTAGE', 0.40, 0.00)
ON CONFLICT DO NOTHING;

-- Inserir configurações do sistema
INSERT INTO system_settings (key, value, description, is_public)
VALUES 
    ('maintenance_mode', 'false', 'Modo de manutenção do sistema', false),
    ('max_withdrawal_per_day', '10000.00', 'Valor máximo de saque por dia', true),
    ('min_withdrawal_amount', '1.00', 'Valor mínimo de saque', true),
    ('referral_bonus_amount', '10.00', 'Bônus de indicação', true),
    ('max_quota_per_user', '100', 'Máximo de cotas por usuário', true),
    ('max_loan_amount', '50000.00', 'Valor máximo de empréstimo', true)
ON CONFLICT DO NOTHING;

-- ========================================
-- VIEWS PARA CONSULTAS FACILITADAS
-- ========================================

-- View para resumo financeiro do usuário
CREATE OR REPLACE VIEW user_financial_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.balance,
    COALESCE(q.total_quotas, 0) as total_quotas,
    COALESCE(q.total_invested, 0) as total_invested,
    COALESCE(l.total_loaned, 0) as total_loaned,
    COALESCE(l.total_to_pay, 0) as total_to_pay,
    COALESCE(t.total_withdrawn, 0) as total_withdrawn
FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_quotas,
        SUM(purchase_price) as total_invested
    FROM quotas 
    WHERE status = 'ACTIVE'
    GROUP BY user_id
) q ON u.id = q.user_id
LEFT JOIN (
    SELECT 
        user_id,
        SUM(amount) as total_loaned,
        SUM(total_repayment) as total_to_pay
    FROM loans 
    WHERE status IN ('APPROVED', 'PAYMENT_PENDING')
    GROUP BY user_id
) l ON u.id = l.user_id
LEFT JOIN (
    SELECT 
        user_id,
        SUM(amount) as total_withdrawn
    FROM transactions 
    WHERE type = 'WITHDRAWAL' AND status = 'APPROVED'
    GROUP BY user_id
) t ON u.id = t.user_id;

-- View para dashboard administrativo
CREATE OR REPLACE VIEW admin_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE is_admin = true) as admin_users,
    (SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE') as active_quotas,
    (SELECT COUNT(*) FROM loans WHERE status IN ('PENDING', 'APPROVED', 'PAYMENT_PENDING')) as active_loans,
    (SELECT COALESCE(SUM(amount), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_loaned,
    (SELECT COALESCE(SUM(total_repayment), 0) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')) as total_to_receive,
    (SELECT COALESCE(system_balance, 0) FROM system_config LIMIT 1) as system_balance,
    (SELECT COALESCE(profit_pool, 0) FROM system_config LIMIT 1) as profit_pool,
    (SELECT COUNT(*) FROM transactions WHERE status = 'PENDING') as pending_transactions;

-- ========================================
-- RELATÓRIO FINAL
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CRIAÇÃO DE TABELAS CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tabelas criadas/atualizadas:';
    RAISE NOTICE '- users (usuários)';
    RAISE NOTICE '- system_config (configurações do sistema)';
    RAISE NOTICE '- quotas (cotas de investimento)';
    RAISE NOTICE '- loans (empréstimos)';
    RAISE NOTICE '- loan_installments (parcelas de empréstimos)';
    RAISE NOTICE '- transactions (transações financeiras)';
    RAISE NOTICE '- audit_logs (logs de auditoria)';
    RAISE NOTICE '- user_sessions (sessões de usuário)';
    RAISE NOTICE '- notification_settings (configurações de notificação)';
    RAISE NOTICE '- notifications (notificações)';
    RAISE NOTICE '- system_settings (configurações gerais)';
    RAISE NOTICE '- daily_reports (relatórios diários)';
    RAISE NOTICE '- user_statistics (estatísticas de usuário)';
    RAISE NOTICE '- referrals (indicações)';
    RAISE NOTICE '- referral_bonuses (bônus de indicação)';
    RAISE NOTICE '- system_fees (taxas do sistema)';
    RAISE NOTICE '- fee_history (histórico de taxas)';
    RAISE NOTICE '- support_tickets (tickets de suporte)';
    RAISE NOTICE '- support_responses (respostas de suporte)';
    RAISE NOTICE '- backup_logs (logs de backup)';
    RAISE NOTICE '';
    RAISE NOTICE 'Índices criados para melhor performance';
    RAISE NOTICE 'Triggers para atualização automática de timestamps';
    RAISE NOTICE 'Views para consultas facilitadas';
    RAISE NOTICE 'Dados iniciais inseridos';
    RAISE NOTICE '========================================';
END $$;