-- =============================================================================
-- SCRIPT DE VERIFICAÇÃO PÓS-LIMPEZA DE DADOS
-- =============================================================================
-- Este script verifica se a limpeza de dados foi executada corretamente
-- e se o sistema está em estado consistente para operação
-- =============================================================================

-- =============================================================================
-- ETAPA 1: VERIFICAÇÃO DE CONTAGEM DE REGISTROS
-- =============================================================================

RAISE NOTICE '🔍 INICIANDO VERIFICAÇÃO PÓS-LIMPEZA...';

-- Verificar contagem de registros em todas as tabelas
SELECT 
    'RECORD_COUNT' AS verification_type,
    table_name,
    CASE 
        WHEN table_name IN ('users', 'quotas', 'loans', 'loan_installments', 'transactions', 'withdrawals') THEN
            CASE 
                WHEN record_count = 0 THEN 'CLEANED'
                WHEN table_name = 'users' AND record_count = 1 THEN 'ADMIN_ONLY'
                ELSE 'REQUIRES_ATTENTION'
            END
        WHEN table_name = 'app_settings' THEN
            CASE 
                WHEN record_count > 0 THEN 'PRESERVED'
                ELSE 'MISSING'
            END
        ELSE 'UNKNOWN'
    END AS status,
    record_count,
    CASE 
        WHEN table_name IN ('users', 'quotas', 'loans', 'loan_installments', 'transactions', 'withdrawals') THEN
            CASE 
                WHEN record_count = 0 THEN '✅ Limpeza bem-sucedida'
                WHEN table_name = 'users' AND record_count = 1 THEN '✅ Apenas admin preservado'
                ELSE '❌ Dados remanescentes'
            END
        WHEN table_name = 'app_settings' THEN
            CASE 
                WHEN record_count > 0 THEN '✅ Configurações preservadas'
                ELSE '❌ Configurações ausentes'
            END
        ELSE '⚠️ Tabela desconhecida'
    END AS message
FROM (
    -- Subquery para obter contagem de todas as tabelas
    SELECT 'users' AS table_name, COUNT(*) AS record_count FROM users
    UNION ALL
    SELECT 'quotas' AS table_name, COUNT(*) AS record_count FROM quotas
    UNION ALL
    SELECT 'loans' AS table_name, COUNT(*) AS record_count FROM loans
    UNION ALL
    SELECT 'loan_installments' AS table_name, COUNT(*) AS record_count FROM loan_installments
    UNION ALL
    SELECT 'transactions' AS table_name, COUNT(*) AS record_count FROM transactions
    UNION ALL
    SELECT 'withdrawals' AS table_name, COUNT(*) AS record_count FROM withdrawals
    UNION ALL
    SELECT 'app_settings' AS table_name, COUNT(*) AS record_count FROM app_settings
) AS table_counts
ORDER BY 
    CASE 
        WHEN status = 'CLEANED' OR status = 'ADMIN_ONLY' OR status = 'PRESERVED' THEN 1
        ELSE 2
    END,
    table_name;

-- =============================================================================
-- ETAPA 2: VERIFICAÇÃO ESPECÍFICA DO ADMINISTRADOR
-- =============================================================================

RAISE NOTICE '🔍 Verificando administrador principal...';

DO $$
DECLARE
    admin_count INTEGER;
    admin_email TEXT;
    admin_name TEXT;
    admin_id UUID;
BEGIN
    -- Verificar se existe exatamente um administrador
    SELECT COUNT(*), email, name, id INTO admin_count, admin_email, admin_name, admin_id
    FROM users 
    WHERE is_admin = TRUE
    GROUP BY email, name, id;
    
    IF admin_count = 1 THEN
        RAISE NOTICE '   ✅ Administrador encontrado: % (%)', admin_email, admin_name;
        
        -- Verificar se é o administrador esperado
        IF admin_email = 'josiassm701@gmail.com' THEN
            RAISE NOTICE '   ✅ Administrador principal preservado corretamente';
        ELSE
            RAISE NOTICE '   ⚠️ Administrador diferente do esperado: %', admin_email;
        END IF;
    ELSIF admin_count = 0 THEN
        RAISE NOTICE '   ❌ Nenhum administrador encontrado!';
    ELSE
        RAISE NOTICE '   ⚠️ Múltiplos administradores encontrados: %', admin_count;
    END IF;
    
    -- Verificar se há usuários não-admin
    IF EXISTS (SELECT 1 FROM users WHERE is_admin = FALSE) THEN
        RAISE NOTICE '   ⚠️ Existem usuários não-administradores no sistema';
    ELSE
        RAISE NOTICE '   ✅ Apenas administradores presentes no sistema';
    END IF;
END $$;

-- =============================================================================
-- ETAPA 3: VERIFICAÇÃO DE INTEGRIDADE REFERENCIAL
-- =============================================================================

RAISE NOTICE '🔍 Verificando integridade referencial...';

-- Verificar se há registros órfãos
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    -- Verificar cotas órfãs
    SELECT COUNT(*) INTO orphan_count 
    FROM quotas q 
    LEFT JOIN users u ON q.user_id = u.id 
    WHERE u.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE '   ❌ Encontradas % cotas órfãs', orphan_count;
    ELSE
        RAISE NOTICE '   ✅ Nenhuma cota órfã encontrada';
    END IF;
    
    -- Verificar empréstimos órfãos
    SELECT COUNT(*) INTO orphan_count 
    FROM loans l 
    LEFT JOIN users u ON l.user_id = u.id 
    WHERE u.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE '   ❌ Encontrados % empréstimos órfãos', orphan_count;
    ELSE
        RAISE NOTICE '   ✅ Nenhum empréstimo órfão encontrado';
    END IF;
    
    -- Verificar transações órfãs
    SELECT COUNT(*) INTO orphan_count 
    FROM transactions t 
    LEFT JOIN users u ON t.user_id = u.id 
    WHERE u.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE '   ❌ Encontradas % transações órfãs', orphan_count;
    ELSE
        RAISE NOTICE '   ✅ Nenhuma transação órfã encontrada';
    END IF;
    
    -- Verificar saques órfãos
    SELECT COUNT(*) INTO orphan_count 
    FROM withdrawals w 
    LEFT JOIN users u ON w.user_id = u.id 
    WHERE u.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE '   ❌ Encontrados % saques órfãos', orphan_count;
    ELSE
        RAISE NOTICE '   ✅ Nenhum saque órfão encontrado';
    END IF;
END $$;

-- =============================================================================
-- ETAPA 4: VERIFICAÇÃO DE SEQUÊNCIAS
-- =============================================================================

RAISE NOTICE '🔍 Verificando sequências...';

-- Verificar estado das sequências
SELECT 
    'SEQUENCE_CHECK' AS verification_type,
    sequence_name,
    last_value,
    is_called,
    CASE 
        WHEN last_value = 1 AND NOT is_called THEN 'RESET'
        WHEN last_value = 1 AND is_called THEN 'USED_ONCE'
        ELSE 'IN_USE'
    END AS status
FROM (
    -- Obter informações das sequências principais
    SELECT 
        'users_id_seq' AS sequence_name,
        last_value,
        is_called
    FROM pg_sequences 
    WHERE sequencename = 'users_id_seq'
    
    UNION ALL
    
    SELECT 
        'quotas_id_seq' AS sequence_name,
        last_value,
        is_called
    FROM pg_sequences 
    WHERE sequencename = 'quotas_id_seq'
    
    UNION ALL
    
    SELECT 
        'loans_id_seq' AS sequence_name,
        last_value,
        is_called
    FROM pg_sequences 
    WHERE sequencename = 'loans_id_seq'
    
    UNION ALL
    
    SELECT 
        'transactions_id_seq' AS sequence_name,
        last_value,
        is_called
    FROM pg_sequences 
    WHERE sequencename = 'transactions_id_seq'
    
    UNION ALL
    
    SELECT 
        'withdrawals_id_seq' AS sequence_name,
        last_value,
        is_called
    FROM pg_sequences 
    WHERE sequencename = 'withdrawals_id_seq'
) AS sequence_info
ORDER BY sequence_name;

-- =============================================================================
-- ETAPA 5: VERIFICAÇÃO DE CONFIGURAÇÕES DO SISTEMA
-- =============================================================================

RAISE NOTICE '🔍 Verificando configurações do sistema...';

-- Verificar configurações essenciais
SELECT 
    'SETTINGS_CHECK' AS verification_type,
    key,
    value,
    description,
    CASE 
        WHEN key IN ('quota_price', 'loan_interest_rate', 'penalty_rate', 'admin_pix_key') THEN 'ESSENTIAL'
        ELSE 'OPTIONAL'
    END AS category,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN 'CONFIGURED'
        ELSE 'MISSING'
    END AS status
FROM app_settings
ORDER BY 
    CASE WHEN category = 'ESSENTIAL' THEN 1 ELSE 2 END,
    key;

-- =============================================================================
-- ETAPA 6: VERIFICAÇÃO DE ESTADO DO SISTEMA
-- =============================================================================

RAISE NOTICE '🔍 Verificando estado geral do sistema...';

-- Resumo do estado do sistema
DO $$
DECLARE
    total_users INTEGER;
    admin_users INTEGER;
    total_settings INTEGER;
    essential_settings INTEGER;
    data_tables_empty INTEGER;
BEGIN
    -- Contar usuários
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO admin_users FROM users WHERE is_admin = TRUE;
    
    -- Contar configurações
    SELECT COUNT(*) INTO total_settings FROM app_settings;
    SELECT COUNT(*) INTO essential_settings 
    FROM app_settings 
    WHERE key IN ('quota_price', 'loan_interest_rate', 'penalty_rate', 'admin_pix_key');
    
    -- Verificar tabelas de dados vazias
    SELECT COUNT(*) INTO data_tables_empty
    FROM (
        SELECT COUNT(*) AS cnt FROM quotas WHERE 1=1
        UNION ALL
        SELECT COUNT(*) FROM loans WHERE 1=1
        UNION ALL
        SELECT COUNT(*) FROM transactions WHERE 1=1
        UNION ALL
        SELECT COUNT(*) FROM withdrawals WHERE 1=1
    ) AS table_counts
    WHERE cnt = 0;
    
    -- Avaliar estado geral
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMO DO ESTADO DO SISTEMA:';
    RAISE NOTICE '   Usuários totais: %', total_users;
    RAISE NOTICE '   Administradores: %', admin_users;
    RAISE NOTICE '   Configurações totais: %', total_settings;
    RAISE NOTICE '   Configurações essenciais: %', essential_settings;
    RAISE NOTICE '   Tabelas de dados vazias: %/4', data_tables_empty;
    
    -- Verificar se o sistema está pronto para operação
    IF total_users = 1 AND admin_users = 1 AND essential_settings = 4 AND data_tables_empty = 4 THEN
        RAISE NOTICE '';
        RAISE NOTICE '   ✅ SISTEMA PRONTO PARA OPERAÇÃO!';
        RAISE NOTICE '   ✅ Apenas administrador presente';
        RAISE NOTICE '   ✅ Todas as configurações essenciais presentes';
        RAISE NOTICE '   ✅ Todas as tabelas de dados limpas';
    ELSIF total_users = 0 AND data_tables_empty = 4 THEN
        RAISE NOTICE '';
        RAISE NOTICE '   ⚠️ SISTEMA PRECISA DE CONFIGURAÇÃO INICIAL!';
        RAISE NOTICE '   ⚠️ Nenhum usuário encontrado';
        RAISE NOTICE '   ⚠️ Será necessário criar o primeiro administrador';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '   ❌ SISTEMA EM ESTADO INCONSISTENTE!';
        RAISE NOTICE '   ❌ Verifique os detalhes acima';
    END IF;
END $$;

-- =============================================================================
-- ETAPA 7: RECOMENDAÇÕES FINAIS
-- =============================================================================

RAISE NOTICE '';
RAISE NOTICE '💡 RECOMENDAÇÕES FINAIS:';

DO $$
DECLARE
    has_admin BOOLEAN;
    has_settings BOOLEAN;
    has_data BOOLEAN;
BEGIN
    -- Verificar condições
    SELECT COUNT(*) > 0 INTO has_admin FROM users WHERE is_admin = TRUE;
    SELECT COUNT(*) = 4 INTO has_settings 
    FROM app_settings 
    WHERE key IN ('quota_price', 'loan_interest_rate', 'penalty_rate', 'admin_pix_key');
    SELECT COUNT(*) = 0 INTO has_data FROM (
        SELECT COUNT(*) FROM quotas
        UNION ALL
        SELECT COUNT(*) FROM loans
        UNION ALL
        SELECT COUNT(*) FROM transactions
        UNION ALL
        SELECT COUNT(*) FROM withdrawals
    ) AS data_counts;
    
    -- Gerar recomendações
    IF has_admin AND has_settings AND has_data THEN
        RAISE NOTICE '   ✅ Sistema limpo e configurado corretamente';
        RAISE NOTICE '   ✅ Pronto para receber novos usuários';
        RAISE NOTICE '   ✅ Administrador pode acessar o sistema normalmente';
    ELSIF NOT has_admin AND has_data THEN
        RAISE NOTICE '   ⚠️ Execute o script de inicialização para criar o primeiro administrador';
        RAISE NOTICE '   ⚠️ Verifique o arquivo init-db-fixed.sql';
    ELSIF has_admin AND NOT has_settings THEN
        RAISE NOTICE '   ⚠️ Configure as configurações essenciais do sistema';
        RAISE NOTICE '   ⚠️ Verifique: quota_price, loan_interest_rate, penalty_rate, admin_pix_key';
    ELSIF NOT has_data THEN
        RAISE NOTICE '   ⚠️ Ainda existem dados residuais no sistema';
        RAISE NOTICE '   ⚠️ Verifique as tabelas que não estão vazias';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Para testar o acesso do administrador:';
    RAISE NOTICE '   1. Acesse a interface da aplicação';
    RAISE NOTICE '   2. Faça login com: josiassm701@gmail.com');
    RAISE NOTICE '   3. Verifique se o painel administrativo funciona corretamente');
    RAISE NOTICE '';
    RAISE NOTICE '🎯 VERIFICAÇÃO CONCLUÍDA!';
END $$;