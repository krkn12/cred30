-- =============================================================================
-- SCRIPT DE LIMPEZA COMPLETA - DEIXAR TUDO ZERADO
-- =============================================================================
-- ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
-- INCLUSIVE CONFIGURAÇÕES DO SISTEMA - DEIXARÁ O BANCO COMPLETAMENTE VAZIO
-- =============================================================================

-- Iniciar transação para garantir atomicidade
BEGIN;

-- Desabilitar triggers para evitar erros durante a limpeza
SET session_replication_role = replica;

-- Desabilitar constraints de foreign key temporariamente
SET CONSTRAINTS ALL DEFERRED;

-- =============================================================================
-- ETAPA 1: LIMPEZA COMPLETA DE TODAS AS TABELAS
-- =============================================================================

-- 1.1 Limpar todas as tabelas em ordem correta (respeitando foreign keys)
-- Limpando parcelas de empréstimos...
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;

-- Limpando saques...
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;

-- Limpando transações financeiras...
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;

-- Limpando cotas de investimento...
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;

-- Limpando empréstimos...
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;

-- Limpando TODOS os usuários (inclusive admin)...
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Limpando configurações do sistema...
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;

-- Limpando tabelas de sistema/log
TRUNCATE TABLE admin_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE rate_limit_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_config RESTART IDENTITY CASCADE;

-- =============================================================================
-- ETAPA 2: RESET COMPLETO DE TODAS AS SEQUÊNCIAS
-- =============================================================================

-- Resetar todas as sequências conhecidas para 1
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loans_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loan_installments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS withdrawals_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS app_settings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS admin_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS rate_limit_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS system_config_id_seq RESTART WITH 1;

-- Resetar todas as sequências automaticamente
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE ' || r.sequence_name || ' RESTART WITH 1';
    END LOOP;
END
$$;

-- =============================================================================
-- ETAPA 3: VERIFICAÇÃO DE LIMPEZA COMPLETA
-- =============================================================================

-- Verificar se todas as tabelas estão vazias
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'quotas' as table_name, COUNT(*) as count FROM quotas
UNION ALL
SELECT 'loans' as table_name, COUNT(*) as count FROM loans
UNION ALL
SELECT 'loan_installments' as table_name, COUNT(*) as count FROM loan_installments
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as count FROM transactions
UNION ALL
SELECT 'withdrawals' as table_name, COUNT(*) as count FROM withdrawals
UNION ALL
SELECT 'app_settings' as table_name, COUNT(*) as count FROM app_settings
UNION ALL
SELECT 'admin_logs' as table_name, COUNT(*) as count FROM admin_logs
UNION ALL
SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs
UNION ALL
SELECT 'rate_limit_logs' as table_name, COUNT(*) as count FROM rate_limit_logs
UNION ALL
SELECT 'system_config' as table_name, COUNT(*) as count FROM system_config;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Confirmar transação
COMMIT;

-- =============================================================================
-- ETAPA 4: RELATÓRIO FINAL
-- =============================================================================

-- LIMPEZA COMPLETA CONCLUÍDA COM SUCESSO!
-- Resumo:
--   ✅ TODOS os usuários foram removidos (inclusive admin)
--   ✅ TODAS as transações financeiras foram removidas
--   ✅ TODAS as cotas de investimento foram removidas
--   ✅ TODOS os empréstimos e parcelas foram removidos
--   ✅ TODOS os saques foram removidos
--   ✅ TODAS as configurações do sistema foram removidas
--   ✅ Todas as sequências foram resetadas para 1
--   ✅ Banco de dados completamente ZERADO
--
-- ⚠️ O sistema está completamente VAZIO!
-- ⚠️ Será necessário recriar TUDO do zero!
-- ⚠️ Execute o script de inicialização: scripts/database/init-db-fixed.sql
-- ⚠️ Crie o primeiro usuário administrador do zero!
--
-- 🔒 BANCO DE DADOS 100% LIMPO E ZERADO!