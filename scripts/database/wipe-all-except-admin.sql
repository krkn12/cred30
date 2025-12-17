-- =============================================================================
-- SCRIPT DE LIMPEZA COMPLETA EXCETO ADMINISTRADOR
-- =============================================================================
-- ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ 100% DE TODOS OS DADOS
-- EXCETO O ADMINISTRADOR PRINCIPAL (josiassm701@gmail.com)
-- =============================================================================

-- Iniciar transação para garantir atomicidade
BEGIN;

-- Desabilitar triggers para evitar erros durante a limpeza
SET session_replication_role = replica;

-- Desabilitar constraints de foreign key temporariamente
SET CONSTRAINTS ALL DEFERRED;

-- =============================================================================
-- ETAPA 1: VERIFICAÇÃO DE SEGURANÇA ANTES DA LIMPEZA
-- =============================================================================

RAISE NOTICE '🚨 AVISO: INICIANDO LIMPEZA COMPLETA EXCETO ADMINISTRADOR';
RAISE NOTICE '⚠️ TODOS OS DADOS SERÃO APAGADOS, EXCETO O ADMIN PRINCIPAL';

-- Verificar se o administrador principal existe
DO $$
DECLARE
    admin_count INTEGER;
    admin_id UUID;
BEGIN
    SELECT COUNT(*), id INTO admin_count, admin_id FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE;
    
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'ERRO DE SEGURANÇA: Administrador principal (josiassm701@gmail.com) não encontrado!';
    END IF;
    
    RAISE NOTICE '✅ Verificação de segurança: Administrador principal encontrado (ID: %)', admin_id;
END $$;

-- =============================================================================
-- ETAPA 2: LIMPEZA COMPLETA DE TODOS OS DADOS (EXCETO ADMIN)
-- =============================================================================

RAISE NOTICE '🧹 Iniciando limpeza completa de todos os dados...';

-- 2.1 Limpar parcelas de empréstimos (depende de loans)
RAISE NOTICE '   Limpando parcelas de empréstimos...';
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;

-- 2.2 Limpar saques (depende de users)
RAISE NOTICE '   Limpando saques...';
TRUNCATE TABLE withdrawals RESTART IDENTITY CASCADE;

-- 2.3 Limpar transações financeiras (depende de users)
RAISE NOTICE '   Limpando transações financeiras...';
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;

-- 2.4 Limpar cotas de investimento (depende de users)
RAISE NOTICE '   Limpando cotas de investimento...';
TRUNCATE TABLE quotas RESTART IDENTITY CASCADE;

-- 2.5 Limpar empréstimos (depende de users)
RAISE NOTICE '   Limpando empréstimos...';
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;

-- 2.6 Limpar configurações do sistema
RAISE NOTICE '   Limpando configurações do sistema...';
TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE;

-- =============================================================================
-- ETAPA 3: PRESERVAR APENAS O ADMINISTRADOR PRINCIPAL
-- =============================================================================

RAISE NOTICE '🔒 Preservando apenas o administrador principal...';

-- Salvar dados do administrador principal
CREATE TEMP TABLE admin_preserve AS
SELECT id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, role, balance, total_invested, created_at, updated_at
FROM users 
WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE;

-- Resetar tabela de usuários
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Restaurar apenas o administrador principal
INSERT INTO users (id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, role, balance, total_invested, created_at, updated_at)
SELECT id, name, email, password_hash, secret_phrase, pix_key, referral_code, is_admin, role, balance, total_invested, created_at, updated_at
FROM admin_preserve;

-- Resetar sequência de usuários para continuar após o ID do admin
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT id FROM admin_preserve), true);

-- =============================================================================
-- ETAPA 4: REINSERIR CONFIGURAÇÕES BÁSICAS DO SISTEMA
-- =============================================================================

RAISE NOTICE '⚙️ Recriando configurações básicas do sistema...';

-- Inserir configurações padrão essenciais
INSERT INTO app_settings (key, value, description) VALUES
('quota_price', '50', 'Preço unitário das cotas de investimento'),
('loan_interest_rate', '0.2', 'Taxa de juros dos empréstimos (20%)'),
('penalty_rate', '0.4', 'Taxa de multa por atraso (40%)'),
('admin_pix_key', 'admin@pix.local', 'Chave PIX do administrador'),
('min_loan_amount', '100', 'Valor mínimo de empréstimo'),
('max_loan_amount', '10000', 'Valor máximo de empréstimo');

-- =============================================================================
-- ETAPA 5: VERIFICAÇÃO E CONSISTÊNCIA PÓS-LIMPEZA
-- =============================================================================

RAISE NOTICE '🔍 Verificando consistência pós-limpeza...';

-- 5.1 Verificar se apenas o administrador principal permanece
DO $$
DECLARE
    remaining_users INTEGER;
    admin_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_users FROM users;
    SELECT COUNT(*) INTO admin_remaining FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE;
    
    IF remaining_users != 1 OR admin_remaining != 1 THEN
        RAISE EXCEPTION 'ERRO: Contagem de usuários inconsistente. Total: %, Admin: %', remaining_users, admin_remaining;
    END IF;
    
    RAISE NOTICE '   ✅ Verificação de usuários: OK (apenas administrador principal)';
END $$;

-- 5.2 Verificar se todas as tabelas de dados estão vazias
DO $$
DECLARE
    table_name TEXT;
    table_count INTEGER;
BEGIN
    FOR table_name IN ARRAY['quotas', 'loans', 'loan_installments', 'transactions', 'withdrawals']
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO table_count;
        
        IF table_count != 0 THEN
            RAISE EXCEPTION 'ERRO: Tabela %I não está vazia. Registros restantes: %', table_name, table_count;
        END IF;
        
        RAISE NOTICE '   ✅ Tabela %I: completamente vazia', table_name;
    END LOOP;
END $$;

-- 5.3 Verificar se configurações do sistema foram recriadas
DO $$
DECLARE
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO settings_count FROM app_settings;
    
    IF settings_count = 0 THEN
        RAISE EXCEPTION 'ERRO: Tabela app_settings está vazia!';
    END IF;
    
    RAISE NOTICE '   ✅ Configurações do sistema recriadas (%)', settings_count;
END $$;

-- =============================================================================
-- ETAPA 6: RESET DE SEQUÊNCIAS E ÍNDICES
-- =============================================================================

RAISE NOTICE '🔄 Resetando sequências e índices...';

-- Resetar todas as sequências para valores iniciais (exceto users que já foi ajustada)
ALTER SEQUENCE IF EXISTS quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loans_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loan_installments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS withdrawals_id_seq RESTART WITH 1;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- =============================================================================
-- ETAPA 7: RELATÓRIO FINAL
-- =============================================================================

RAISE NOTICE '📊 GERANDO RELATÓRIO FINAL DA LIMPEZA...';

-- Relatório do administrador preservado
SELECT 
    'ADMIN_REPORT' AS section,
    'admin_preserved' AS metric,
    email AS value,
    'Administrador principal preservado com sucesso' AS message
FROM users 
WHERE email = 'josiassm701@gmail.com'

UNION ALL

-- Relatório de tabelas limpas
SELECT 
    'TABLES_REPORT' AS section,
    table_name AS metric,
    'COMPLETELY_WIPED' AS value,
    'Todos os dados removidos' AS message
FROM (
    SELECT 'quotas' AS table_name UNION
    SELECT 'loans' UNION
    SELECT 'loan_installments' UNION
    SELECT 'transactions' UNION
    SELECT 'withdrawals'
) AS cleaned_tables

UNION ALL

-- Relatório de configurações recriadas
SELECT 
    'SETTINGS_REPORT' AS section,
    'essential_settings' AS metric,
    COUNT(*)::text AS value,
    'Configurações essenciais recriadas' AS message
FROM app_settings;

-- Limpar tabela temporária
DROP TABLE IF EXISTS admin_preserve;

-- Confirmar transação
COMMIT;

RAISE NOTICE '🎉 LIMPEZA COMPLETA CONCLUÍDA COM SUCESSO!';
RAISE NOTICE '📋 Resumo:';
RAISE NOTICE '   ✅ 100% dos dados de usuários foram removidos';
RAISE NOTICE '   ✅ 100% das transações financeiras foram removidas';
RAISE NOTICE '   ✅ 100% das cotas de investimento foram removidas';
RAISE NOTICE '   ✅ 100% dos empréstimos e parcelas foram removidos';
RAISE NOTICE '   ✅ 100% dos saques foram removidos';
RAISE NOTICE '   ✅ Apenas o administrador principal foi preservado';
RAISE NOTICE '   ✅ Configurações essenciais do sistema recriadas';
RAISE NOTICE '   ✅ Sequências resetadas';
RAISE NOTICE '   ✅ Integridade referencial mantida';
RAISE NOTICE '';
RAISE NOTICE '⚠️ O sistema está pronto para operação com apenas o administrador principal!';
RAISE NOTICE '⚠️ O administrador (josiassm701@gmail.com) pode acessar normalmente!';