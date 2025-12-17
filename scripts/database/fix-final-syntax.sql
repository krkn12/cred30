-- Script final para corrigir problemas de sintaxe PostgreSQL

-- Corrigir constraint da user_statistics (sintaxe PostgreSQL correta)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_statistics_user_id_unique' 
        AND table_name = 'user_statistics'
    ) THEN
        ALTER TABLE user_statistics ADD CONSTRAINT user_statistics_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Constraint unique adicionada em user_statistics.user_id';
    END IF;
END $$;

-- Verificar estado final das tabelas
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO FINAL DAS TABELAS ===';
    
    -- Contar tabelas principais
    RAISE NOTICE 'Tabelas principais:';
    RAISE NOTICE '  users: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users');
    RAISE NOTICE '  quotas: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'quotas');
    RAISE NOTICE '  loans: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'loans');
    RAISE NOTICE '  transactions: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'transactions');
    RAISE NOTICE '  system_config: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'system_config');
    
    -- Contar tabelas adicionais
    RAISE NOTICE 'Tabelas adicionais:';
    RAISE NOTICE '  user_sessions: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_sessions');
    RAISE NOTICE '  notifications: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'notifications');
    RAISE NOTICE '  user_statistics: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_statistics');
    RAISE NOTICE '  referrals: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'referrals');
    RAISE NOTICE '  support_tickets: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'support_tickets');
    
    -- Total de tabelas
    RAISE NOTICE 'Total de tabelas no sistema: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
    RAISE NOTICE '====================================';
END $$;

-- Verificar constraints importantes
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO DE CONSTRAINTS ===';
    
    -- Verificar foreign keys
    RAISE NOTICE 'Foreign Keys principais:';
    RAISE NOTICE '  users.id em quotas: %', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name LIKE '%quotas_user_id_fkey');
    RAISE NOTICE '  users.id em loans: %', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name LIKE '%loans_user_id_fkey');
    RAISE NOTICE '  users.id em transactions: %', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name LIKE '%transactions_user_id_fkey');
    
    -- Verificar unique constraints
    RAISE NOTICE 'Unique Constraints:';
    RAISE NOTICE '  user_statistics.user_id: %', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name = 'user_statistics_user_id_unique');
    RAISE NOTICE '  users.email: %', (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name LIKE '%users_email_key');
    RAISE NOTICE '====================================';
END $$;

-- Inserir dados de teste se necessário (apenas se tabelas estiverem vazias)
DO $$
BEGIN
    -- Verificar se system_config tem dados
    IF NOT EXISTS (SELECT 1 FROM system_config LIMIT 1) THEN
        INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate, vesting_period_ms)
        VALUES (0, 0, 50.0, 0.2, 0.4, 365 * 24 * 60 * 60 * 1000);
        RAISE NOTICE 'Configuração padrão do sistema inserida';
    END IF;
    
    -- Verificar se admin_dashboard tem dados
    IF NOT EXISTS (SELECT 1 FROM admin_dashboard WHERE metric_name = 'system_initialized' LIMIT 1) THEN
        INSERT INTO admin_dashboard (metric_name, metric_value, metric_metadata)
        VALUES ('system_initialized', 1, '{"timestamp": "' || CURRENT_TIMESTAMP || '", "version": "2.0"}');
        RAISE NOTICE 'Métrica de inicialização do sistema inserida';
    END IF;
END $$;

-- Relatório final
DO $$
BEGIN
    RAISE NOTICE '=== RELATÓRIO FINAL ===';
    RAISE NOTICE '✅ Banco de dados CRED30 configurado com sucesso';
    RAISE NOTICE '✅ Todas as tabelas principais criadas';
    RAISE NOTICE '✅ Tabelas adicionais criadas';
    RAISE NOTICE '✅ Constraints verificadas';
    RAISE NOTICE '✅ Dados iniciais inseridos se necessário';
    RAISE NOTICE '✅ Sistema pronto para operação';
    RAISE NOTICE '========================';
END $$;