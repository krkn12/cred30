-- Script para extrair TODOS os dados do banco de dados CRED30
-- Gera um backup completo em formato SQL

-- Configurar formato de saída
\pset footer off
\pset format unaligned
\pset tuples_only off
\pset fieldsep '|'

-- Criar diretório de backup se não existir (comando shell)
-- NOTA: Este comando precisa ser executado fora do PostgreSQL

-- Iniciar transação para consistência
BEGIN;

-- Mostrar informações do banco
\echo '=== EXTRAÇÃO COMPLETA DE DADOS - CRED30 ==='
\echo 'Data/Hora: ' || CURRENT_TIMESTAMP
\echo 'Banco: cred30'
\echo 'Usuário: cred30user'
\echo '====================================='

-- Extrair dados de cada tabela em ordem de dependência

-- 1. Tabelas de configuração (sem dependências)
\echo ''
\echo '-- 1. TABELAS DE CONFIGURAÇÃO --'
\echo ''

-- system_config
\echo '-- system_config'
COPY (SELECT 'system_config' as table_name, COUNT(*) as total_records FROM system_config) TO STDOUT WITH CSV HEADER;
COPY system_config TO STDOUT WITH CSV HEADER;

-- system_settings
\echo '-- system_settings'
COPY (SELECT 'system_settings' as table_name, COUNT(*) as total_records FROM system_settings) TO STDOUT WITH CSV HEADER;
COPY system_settings TO STDOUT WITH CSV HEADER;

-- system_fees
\echo '-- system_fees'
COPY (SELECT 'system_fees' as table_name, COUNT(*) as total_records FROM system_fees) TO STDOUT WITH CSV HEADER;
COPY system_fees TO STDOUT WITH CSV HEADER;

-- app_settings
\echo '-- app_settings'
COPY (SELECT 'app_settings' as table_name, COUNT(*) as total_records FROM app_settings) TO STDOUT WITH CSV HEADER;
COPY app_settings TO STDOUT WITH CSV HEADER;

-- 2. Tabelas de usuários (dependência principal)
\echo ''
\echo '-- 2. TABELAS DE USUÁRIOS --'
\echo ''

-- users
\echo '-- users'
COPY (SELECT 'users' as table_name, COUNT(*) as total_records FROM users) TO STDOUT WITH CSV HEADER;
COPY users TO STDOUT WITH CSV HEADER;

-- user_sessions
\echo '-- user_sessions'
COPY (SELECT 'user_sessions' as table_name, COUNT(*) as total_records FROM user_sessions) TO STDOUT WITH CSV HEADER;
COPY user_sessions TO STDOUT WITH CSV HEADER;

-- notification_settings
\echo '-- notification_settings'
COPY (SELECT 'notification_settings' as table_name, COUNT(*) as total_records FROM notification_settings) TO STDOUT WITH CSV HEADER;
COPY notification_settings TO STDOUT WITH CSV HEADER;

-- user_statistics
\echo '-- user_statistics'
COPY (SELECT 'user_statistics' as table_name, COUNT(*) as total_records FROM user_statistics) TO STDOUT WITH CSV HEADER;
COPY user_statistics TO STDOUT WITH CSV HEADER;

-- notifications
\echo '-- notifications'
COPY (SELECT 'notifications' as table_name, COUNT(*) as total_records FROM notifications) TO STDOUT WITH CSV HEADER;
COPY notifications TO STDOUT WITH CSV HEADER;

-- referrals
\echo '-- referrals'
COPY (SELECT 'referrals' as table_name, COUNT(*) as total_records FROM referrals) TO STDOUT WITH CSV HEADER;
COPY referrals TO STDOUT WITH CSV HEADER;

-- support_tickets
\echo '-- support_tickets'
COPY (SELECT 'support_tickets' as table_name, COUNT(*) as total_records FROM support_tickets) TO STDOUT WITH CSV HEADER;
COPY support_tickets TO STDOUT WITH CSV HEADER;

-- 3. Tabelas financeiras (dependem de users)
\echo ''
\echo '-- 3. TABELAS FINANCEIRAS --'
\echo ''

-- quotas
\echo '-- quotas'
COPY (SELECT 'quotas' as table_name, COUNT(*) as total_records FROM quotas) TO STDOUT WITH CSV HEADER;
COPY quotas TO STDOUT WITH CSV HEADER;

-- loans
\echo '-- loans'
COPY (SELECT 'loans' as table_name, COUNT(*) as total_records FROM loans) TO STDOUT WITH CSV HEADER;
COPY loans TO STDOUT WITH CSV HEADER;

-- loan_installments
\echo '-- loan_installments'
COPY (SELECT 'loan_installments' as table_name, COUNT(*) as total_records FROM loan_installments) TO STDOUT WITH CSV HEADER;
COPY loan_installments TO STDOUT WITH CSV HEADER;

-- transactions
\echo '-- transactions'
COPY (SELECT 'transactions' as table_name, COUNT(*) as total_records FROM transactions) TO STDOUT WITH CSV HEADER;
COPY transactions TO STDOUT WITH CSV HEADER;

-- withdrawals
\echo '-- withdrawals'
COPY (SELECT 'withdrawals' as table_name, COUNT(*) as total_records FROM withdrawals) TO STDOUT WITH CSV HEADER;
COPY withdrawals TO STDOUT WITH CSV HEADER;

-- fee_history
\echo '-- fee_history'
COPY (SELECT 'fee_history' as table_name, COUNT(*) as total_records FROM fee_history) TO STDOUT WITH CSV HEADER;
COPY fee_history TO STDOUT WITH CSV HEADER;

-- 4. Tabelas administrativas
\echo ''
\echo '-- 4. TABELAS ADMINISTRATIVAS --'
\echo ''

-- admin_dashboard
\echo '-- admin_dashboard'
COPY (SELECT 'admin_dashboard' as table_name, COUNT(*) as total_records FROM admin_dashboard) TO STDOUT WITH CSV HEADER;
COPY admin_dashboard TO STDOUT WITH CSV HEADER;

-- user_financial_summary
\echo '-- user_financial_summary'
COPY (SELECT 'user_financial_summary' as table_name, COUNT(*) as total_records FROM user_financial_summary) TO STDOUT WITH CSV HEADER;
COPY user_financial_summary TO STDOUT WITH CSV HEADER;

-- daily_reports
\echo '-- daily_reports'
COPY (SELECT 'daily_reports' as table_name, COUNT(*) as total_records FROM daily_reports) TO STDOUT WITH CSV HEADER;
COPY daily_reports TO STDOUT WITH CSV HEADER;

-- 5. Tabelas de auditoria
\echo ''
\echo '-- 5. TABELAS DE AUDITORIA --'
\echo ''

-- audit_logs
\echo '-- audit_logs'
COPY (SELECT 'audit_logs' as table_name, COUNT(*) as total_records FROM audit_logs) TO STDOUT WITH CSV HEADER;
COPY audit_logs TO STDOUT WITH CSV HEADER;

-- admin_logs
\echo '-- admin_logs'
COPY (SELECT 'admin_logs' as table_name, COUNT(*) as total_records FROM admin_logs) TO STDOUT WITH CSV HEADER;
COPY admin_logs TO STDOUT WITH CSV HEADER;

-- backup_logs
\echo '-- backup_logs'
COPY (SELECT 'backup_logs' as table_name, COUNT(*) as total_records FROM backup_logs) TO STDOUT WITH CSV HEADER;
COPY backup_logs TO STDOUT WITH CSV HEADER;

-- rate_limit_logs
\echo '-- rate_limit_logs'
COPY (SELECT 'rate_limit_logs' as table_name, COUNT(*) as total_records FROM rate_limit_logs) TO STDOUT WITH CSV HEADER;
COPY rate_limit_logs TO STDOUT WITH CSV HEADER;

-- Finalizar transação
COMMIT;

-- Resumo final
\echo ''
\echo '=== RESUMO DA EXTRAÇÃO ==='
\echo 'Data/Hora: ' || CURRENT_TIMESTAMP
\echo 'Total de tabelas: 25'
\echo 'Status: CONCLUÍDO COM SUCESSO'
\echo '====================================='

-- Estatísticas finais
\echo ''
\echo '-- ESTATÍSTICAS FINAIS --'
SELECT 
    'users' as table_name,
    COUNT(*) as total_records
FROM users
UNION ALL
SELECT 
    'quotas' as table_name,
    COUNT(*) as total_records
FROM quotas
UNION ALL
SELECT 
    'loans' as table_name,
    COUNT(*) as total_records
FROM loans
UNION ALL
SELECT 
    'transactions' as table_name,
    COUNT(*) as total_records
FROM transactions
UNION ALL
SELECT 
    'withdrawals' as table_name,
    COUNT(*) as total_records
FROM withdrawals
UNION ALL
SELECT 
    'audit_logs' as table_name,
    COUNT(*) as total_records
FROM audit_logs
ORDER BY table_name;

\echo ''
\echo '=== EXTRAÇÃO CONCLUÍDA ==='