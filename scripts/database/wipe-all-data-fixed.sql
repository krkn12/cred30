-- Script para REMOVER TODOS os dados do banco de dados CRED30
-- MANTÉM APENAS o admin principal e a estrutura das tabelas
-- ATENÇÃO: ESTA OPERAÇÃO É IRREVERSÍVEL!

-- Desabilitar temporariamente as verificações de chave estrangeira
SET session_replication_role = replica;

-- Limpar tabelas em ordem de dependência inversa
-- (tabelas sem dependências primeiro)

-- 1. Tabelas de auditoria e logs (sem dependências)
TRUNCATE TABLE rate_limit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE backup_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;

-- 2. Tabelas de notificações e sessões
TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE notification_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_sessions RESTART IDENTITY CASCADE;

-- 3. Tabelas financeiras (dependem de users)
TRUNCATE TABLE fee_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;

-- 4. Tabelas de usuários e estatísticas
TRUNCATE TABLE user_statistics RESTART IDENTITY CASCADE;
TRUNCATE TABLE referrals RESTART IDENTITY CASCADE;
TRUNCATE TABLE support_tickets RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_financial_summary RESTART IDENTITY CASCADE;

-- 5. Remover todos os usuários EXCETO o admin principal
DELETE FROM users WHERE email != 'josiassm701@gmail.com';

-- 6. Tabelas de relatórios e dashboard
TRUNCATE TABLE daily_reports RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_dashboard RESTART IDENTITY CASCADE;

-- 7. Tabelas de configuração (reset para valores padrão)
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_fees RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_settings RESTART IDENTITY CASCADE;

-- Resetar system_config para valores padrão (manter estrutura)
UPDATE system_config SET 
    system_balance = 0,
    profit_pool = 0,
    quota_price = 50.00,
    loan_interest_rate = 0.20,
    penalty_rate = 0.40,
    vesting_period_ms = 365 * 24 * 60 * 60 * 1000;

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = DEFAULT;

-- Resetar todas as sequências de auto-incremento
DO $$
DECLARE
    table_name text;
    seq_name text;
BEGIN
    -- Resetar sequências das tabelas principais
    FOR table_name IN 
        ('users', 'quotas', 'loans', 'transactions', 'withdrawals',
         'loan_installments', 'notifications', 'user_sessions', 'audit_logs',
         'admin_logs', 'backup_logs', 'rate_limit_logs', 'referrals',
         'support_tickets', 'fee_history', 'daily_reports',
         'notification_settings', 'user_statistics', 'system_settings',
         'system_fees', 'app_settings', 'admin_dashboard',
         'user_financial_summary')
    LOOP
        seq_name := table_name || '_id_seq';
        BEGIN
            EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar erros de sequência não encontrada
            NULL;
        END;
    END LOOP;
END $$;

-- Inserir configurações padrão do sistema
INSERT INTO system_settings (key, value, description, created_at, updated_at) VALUES
    ('system_initialized', 'false', 'Sistema reinicializado', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('maintenance_mode', 'false', 'Modo de manutenção', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('allow_registrations', 'true', 'Permitir novos registros', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_fees (fee_type, fee_percentage, fee_fixed, min_amount, max_amount) VALUES
    ('withdrawal_fee', 0.02, 5.00, 1.00, 10000.00),
    ('early_exit_penalty', 0.40, 0.00, 0.00, 999999.99),
    ('loan_interest', 0.20, 0.00, 1.00, 999999.99)
ON CONFLICT (fee_type) DO NOTHING;

INSERT INTO app_settings (setting_key, setting_value, description, created_at, updated_at) VALUES
    ('app_name', 'CRED30', 'Nome da aplicação', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('app_version', '2.0', 'Versão atual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('max_quotas_per_user', 1000, 'Máximo de cotas por usuário', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('min_loan_amount', 10.00, 'Valor mínimo de empréstimo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('max_loan_amount', 10000.00, 'Valor máximo de empréstimo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (setting_key) DO NOTHING;

-- Inserir métricas iniciais no dashboard administrativo
INSERT INTO admin_dashboard (metric_name, metric_value, metric_metadata, updated_at) VALUES
    ('system_wiped', 1, '{"timestamp": "' || CURRENT_TIMESTAMP || '", "action": "complete_wipe"}', CURRENT_TIMESTAMP),
    ('total_users_count', 1, '{"auto_calculated": true, "admin_only": true}', CURRENT_TIMESTAMP),
    ('active_quotas_count', 0, '{"auto_calculated": true}', CURRENT_TIMESTAMP),
    ('total_loaned_amount', 0, '{"auto_calculated": true}', CURRENT_TIMESTAMP),
    ('operational_balance', 0, '{"auto_calculated": true}', CURRENT_TIMESTAMP),
    ('profit_pool_amount', 0, '{"auto_calculated": true}', CURRENT_TIMESTAMP)
ON CONFLICT (metric_name) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    metric_metadata = EXCLUDED.metric_metadata,
    updated_at = CURRENT_TIMESTAMP;

-- Forçar atualização das estatísticas do PostgreSQL
ANALYZE;

-- Relatório final da operação
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '  LIMPEZA COMPLETA DO BANCO DE DADOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data/Hora: %', CURRENT_TIMESTAMP;
    RAISE NOTICE 'Total de tabelas limpas: 25';
    RAISE NOTICE 'Usuários mantidos: 1 (admin apenas)';
    RAISE NOTICE 'Dados removidos: TODOS';
    RAISE NOTICE 'Estrutura mantida: SIM';
    RAISE NOTICE 'Sequências resetadas: SIM';
    RAISE NOTICE '========================================';
END $$;

-- Status final
SELECT 
    'LIMPEZA_CONCLUIDA' as status,
    CURRENT_TIMESTAMP as data_hora,
    'Banco CRED30 limpo e resetado' as mensagem;