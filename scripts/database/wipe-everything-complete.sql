-- =====================================================
-- LIMPEZA COMPLETA E TOTAL DO BANCO DE DADOS - CRED30
-- =====================================================
-- Apaga TODOS os dados, incluindo o admin
-- Deixa apenas a estrutura das tabelas
-- Reset completo de todas as sequências
-- =====================================================

-- Desabilitar triggers para evitar erros
ALTER TABLE user_statistics DISABLE TRIGGER ALL;
ALTER TABLE quotas DISABLE TRIGGER ALL;
ALTER TABLE loans DISABLE TRIGGER ALL;
ALTER TABLE loan_installments DISABLE TRIGGER ALL;
ALTER TABLE withdrawals DISABLE TRIGGER ALL;

-- Limpar tabelas de logs e auditoria (ordem inversa das dependências)
TRUNCATE TABLE rate_limit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE backup_logs RESTART IDENTITY CASCADE;

-- Limpar tabelas de sistema
TRUNCATE TABLE fee_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_fees RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_config RESTART IDENTITY CASCADE;

-- Limpar tabelas de suporte e notificações
TRUNCATE TABLE support_tickets RESTART IDENTITY CASCADE;
TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE notification_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE referrals RESTART IDENTITY CASCADE;

-- Limpar tabelas de relatórios e estatísticas
TRUNCATE TABLE user_financial_summary RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_dashboard RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_statistics RESTART IDENTITY CASCADE;
TRUNCATE TABLE daily_reports RESTART IDENTITY CASCADE;

-- Limpar tabelas de sessões e autenticação
TRUNCATE TABLE user_sessions RESTART IDENTITY CASCADE;

-- Limpar tabelas financeiras (ordem correta para evitar FK violations)
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;

-- LIMPEZA FINAL - Apagar o admin também
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Reabilitar triggers
ALTER TABLE user_statistics ENABLE TRIGGER ALL;
ALTER TABLE quotas ENABLE TRIGGER ALL;
ALTER TABLE loans ENABLE TRIGGER ALL;
ALTER TABLE loan_installments ENABLE TRIGGER ALL;
ALTER TABLE withdrawals ENABLE TRIGGER ALL;

-- Reset completo de todas as sequências
SELECT setval(pg_get_serial_sequence('rate_limit_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('admin_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('backup_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('fee_history', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('system_fees', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('system_settings', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('app_settings', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('system_config', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('support_tickets', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('notifications', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('notification_settings', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('referrals', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('user_financial_summary', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('admin_dashboard', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('user_statistics', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('daily_reports', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('user_sessions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('loan_installments', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('loans', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('withdrawals', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('transactions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('quotas', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('users', 'id'), 1, false);

-- Verificação final
DO $$
DECLARE
    table_count INTEGER;
    total_rows INTEGER;
BEGIN
    -- Contar tabelas
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    -- Contar registros totais
    SELECT SUM(n_tup_ins) INTO total_rows
    FROM pg_stat_user_tables;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'LIMPEZA COMPLETA CONCLUÍDA!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total de tabelas: %', table_count;
    RAISE NOTICE 'Total de registros: %', total_rows;
    RAISE NOTICE 'Status: BANCO ZERADO - APENAS ESTRUTURA';
    RAISE NOTICE '===========================================';
END $$;

-- Mostrar status de cada tabela
SELECT 
    schemaname,
    tablename,
    n_tup_ins as total_insercoes,
    n_live_tup as registros_atuais,
    n_dead_tup as registros_mortos
FROM pg_stat_user_tables 
ORDER BY tablename;