-- Script para corrigir e adicionar as tabelas faltantes
-- Resolvendo problemas de compatibilidade de tipos (UUID vs Integer)

-- Verificar tipo da coluna id na tabela users
DO $$
BEGIN
    -- Tabela user_sessions (corrigida para usar integer se users.id for integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        CREATE TABLE user_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
        CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
        
        RAISE NOTICE 'Tabela user_sessions criada com sucesso';
    END IF;
    
    -- Tabela notification_settings (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_settings') THEN
        CREATE TABLE notification_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email_notifications BOOLEAN DEFAULT true,
            sms_notifications BOOLEAN DEFAULT false,
            push_notifications BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índice
        CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
        
        -- Trigger
        CREATE TRIGGER update_notification_settings_updated_at 
            BEFORE UPDATE ON notification_settings 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Tabela notification_settings criada com sucesso';
    END IF;
    
    -- Tabela notifications (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'info',
            read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_read ON notifications(read);
        CREATE INDEX idx_notifications_type ON notifications(type);
        
        RAISE NOTICE 'Tabela notifications criada com sucesso';
    END IF;
    
    -- Tabela user_statistics (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_statistics') THEN
        CREATE TABLE user_statistics (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            total_invested DECIMAL(15,2) DEFAULT 0,
            total_withdrawn DECIMAL(15,2) DEFAULT 0,
            total_earned DECIMAL(15,2) DEFAULT 0,
            active_quotas INTEGER DEFAULT 0,
            total_loans INTEGER DEFAULT 0,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_user_statistics_user_id ON user_statistics(user_id);
        CREATE INDEX idx_user_statistics_last_activity ON user_statistics(last_activity);
        
        -- Trigger
        CREATE TRIGGER update_user_statistics_updated_at 
            BEFORE UPDATE ON user_statistics 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Tabela user_statistics criada com sucesso';
    END IF;
    
    -- Tabela referrals (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals') THEN
        CREATE TABLE referrals (
            id SERIAL PRIMARY KEY,
            referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referral_code VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            bonus_amount DECIMAL(15,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
        CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);
        CREATE INDEX idx_referrals_code ON referrals(referral_code);
        
        -- Trigger
        CREATE TRIGGER update_referrals_updated_at 
            BEFORE UPDATE ON referrals 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Tabela referrals criada com sucesso';
    END IF;
    
    -- Adicionar coluna referred_by na tabela users se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referred_by') THEN
        ALTER TABLE users ADD COLUMN referred_by INTEGER REFERENCES users(id);
        CREATE INDEX idx_users_referred_by ON users(referred_by);
        RAISE NOTICE 'Coluna referred_by adicionada à tabela users';
    END IF;
    
    -- Tabela support_tickets (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        CREATE TABLE support_tickets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'open',
            priority VARCHAR(20) DEFAULT 'normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
        CREATE INDEX idx_support_tickets_status ON support_tickets(status);
        CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
        
        -- Trigger
        CREATE TRIGGER update_support_tickets_updated_at 
            BEFORE UPDATE ON support_tickets 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Tabela support_tickets criada com sucesso';
    END IF;
    
    -- Tabela fee_history (corrigida para usar integer)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_history') THEN
        CREATE TABLE fee_history (
            id SERIAL PRIMARY KEY,
            transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            fee_type VARCHAR(50) NOT NULL,
            fee_amount DECIMAL(15,2) NOT NULL,
            fee_percentage DECIMAL(5,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Índices
        CREATE INDEX idx_fee_history_transaction_id ON fee_history(transaction_id);
        CREATE INDEX idx_fee_history_type ON fee_history(fee_type);
        CREATE INDEX idx_fee_history_created_at ON fee_history(created_at);
        
        RAISE NOTICE 'Tabela fee_history criada com sucesso';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CORREÇÃO DE TABELAS CONCLUÍDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tabelas corrigidas/criadas:';
    RAISE NOTICE '- user_sessions (sessões de usuário)';
    RAISE NOTICE '- notification_settings (configurações de notificação)';
    RAISE NOTICE '- notifications (notificações)';
    RAISE NOTICE '- user_statistics (estatísticas de usuário)';
    RAISE NOTICE '- referrals (indicações)';
    RAISE NOTICE '- support_tickets (tickets de suporte)';
    RAISE NOTICE '- fee_history (histórico de taxas)';
    RAISE NOTICE '- Coluna referred_by adicionada à tabela users';
    RAISE NOTICE '========================================';
END $$;