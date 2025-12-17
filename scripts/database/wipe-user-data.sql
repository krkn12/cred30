-- =============================================================================
-- SCRIPT DE LIMPEZA PERMANENTE DE DADOS DE USUÁRIOS E TRANSAÇÕES
-- =============================================================================
-- ⚠️ AVISO EXTREMO: ESTE SCRIPT APAGARÁ TODOS OS DADOS DE USUÁRIOS REGULARES
-- E TRANSAÇÕES FINANCEIRAS, PRESERVANDO APENAS O ADMINISTRADOR PRINCIPAL
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

-- Verificar se o administrador principal existe
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE;
    
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'ERRO DE SEGURANÇA: Administrador principal (josiassm701@gmail.com) não encontrado!';
    END IF;
    
    RAISE NOTICE '✅ Verificação de segurança: Administrador principal encontrado';
END $$;

-- =============================================================================
-- ETAPA 2: LIMPEZA DE DADOS DE TRANSAÇÕES (ORDEM INVERSA DAS DEPENDÊNCIAS)
-- =============================================================================

RAISE NOTICE '🧹 Iniciando limpeza de dados de transações...';

-- 2.1 Limpar parcelas de empréstimos (depende de loans)
RAISE NOTICE '   Limpando parcelas de empréstimos...';
TRUNCATE TABLE loan_installments RESTART IDENTITY CASCADE;

-- 2.2 Limper saques (depende de users)
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

-- =============================================================================
-- ETAPA 3: LIMPEZA SELETIVA DE USUÁRIOS (PRESERVAR ADMIN)
-- =============================================================================

RAISE NOTICE '🧹 Iniciando limpeza seletiva de usuários...';

-- 3.1 Salvar ID do administrador principal para preservação
CREATE TEMP TABLE admin_preserve AS
SELECT id FROM users WHERE email = 'josiassm701@gmail.com' AND is_admin = TRUE;

-- 3.2 Verificar se há outros administradores
RAISE NOTICE '   Verificando outros administradores...';
DO $$
DECLARE
    other_admins INTEGER;
BEGIN
    SELECT COUNT(*) INTO other_admins FROM users WHERE is_admin = TRUE AND email != 'josiassm701@gmail.com';
    
    IF other_admins > 0 THEN
        RAISE NOTICE '   ⚠️ Encontrados % outros administradores que serão removidos', other_admins;
    ELSE
        RAISE NOTICE '   ✅ Nenhum outro administrador encontrado';
    END IF;
END $$;

-- 3.3 Remover todos os usuários exceto o administrador principal
RAISE NOTICE '   Removendo usuários regulares e outros administradores...';
DELETE FROM users WHERE id NOT IN (SELECT id FROM admin_preserve);

-- 3.4 Resetar sequência de usuários para começar do próximo valor
RAISE NOTICE '   Resetando sequência de usuários...';
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users), true);

-- =============================================================================
-- ETAPA 4: VERIFICAÇÃO E CONSISTÊNCIA PÓS-LIMPEZA
-- =============================================================================

RAISE NOTICE '🔍 Verificando consistência pós-limpeza...';

-- 4.1 Verificar se apenas o administrador principal permanece
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

-- 4.2 Verificar se todas as tabelas de dados estão vazias
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
        
        RAISE NOTICE '   ✅ Tabela %I: vazia', table_name;
    END LOOP;
END $$;

-- 4.3 Verificar se configurações do sistema foram preservadas
DO $$
DECLARE
    settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO settings_count FROM app_settings;
    
    IF settings_count = 0 THEN
        RAISE EXCEPTION 'ERRO: Tabela app_settings está vazia!';
    END IF;
    
    RAISE NOTICE '   ✅ Configurações do sistema preservadas (%)', settings_count;
END $$;

-- =============================================================================
-- ETAPA 5: RESET DE SEQUÊNCIAS E ÍNDICES
-- =============================================================================

RAISE NOTICE '🔄 Resetando sequências e índices...';

-- Resetar todas as sequências para valores iniciais
ALTER SEQUENCE IF EXISTS quotas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loans_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS loan_installments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS withdrawals_id_seq RESTART WITH 1;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- =============================================================================
-- ETAPA 6: RELATÓRIO FINAL
-- =============================================================================

RAISE NOTICE '📊 GERANDO RELATÓRIO FINAL DA LIMPEZA...';

-- Relatório de usuários
SELECT 
    'USERS_REPORT' AS section,
    'remaining_users' AS metric,
    COUNT(*)::text AS value
FROM users

UNION ALL

SELECT 
    'USERS_REPORT' AS section,
    'admin_preserved' AS metric,
    COUNT(CASE WHEN email = 'josiassm701@gmail.com' THEN 1 END)::text AS value
FROM users

UNION ALL

-- Relatório de tabelas limpas
SELECT 
    'TABLES_REPORT' AS section,
    table_name AS metric,
    'CLEANED' AS value
FROM (
    SELECT 'quotas' AS table_name UNION
    SELECT 'loans' UNION
    SELECT 'loan_installments' UNION
    SELECT 'transactions' UNION
    SELECT 'withdrawals'
) AS cleaned_tables

UNION ALL

-- Relatório de tabelas preservadas
SELECT 
    'PRESERVED_REPORT' AS section,
    table_name AS metric,
    COUNT(*)::text AS value
FROM (
    SELECT 'app_settings' AS table_name, COUNT(*) AS count FROM app_settings
    UNION ALL
    SELECT 'users' AS table_name, COUNT(*) AS count FROM users
) AS preserved_tables
GROUP BY table_name;

-- Limpar tabela temporária
DROP TABLE IF EXISTS admin_preserve;

-- Confirmar transação
COMMIT;

RAISE NOTICE '🎉 LIMPEZA DE DADOS CONCLUÍDA COM SUCESSO!';
RAISE NOTICE '📋 Resumo:';
RAISE NOTICE '   ✅ Todos os dados de usuários regulares foram removidos';
RAISE NOTICE '   ✅ Todas as transações financeiras foram removidas';
RAISE NOTICE '   ✅ Administrador principal (josiassm701@gmail.com) preservado';
RAISE NOTICE '   ✅ Configurações do sistema preservadas';
RAISE NOTICE '   ✅ Sequências resetadas';
RAISE NOTICE '   ✅ Integridade referencial mantida';
RAISE NOTICE '';
RAISE NOTICE '⚠️ O sistema está pronto para operação com apenas o administrador principal!';