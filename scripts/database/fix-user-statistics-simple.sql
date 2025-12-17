-- Script simplificado para corrigir o problema da user_statistics

-- Remover o trigger que está causando erro
DROP TRIGGER IF EXISTS trigger_update_user_statistics ON users;
DROP FUNCTION IF EXISTS update_user_statistics();

-- Verificar e adicionar constraint unique manualmente
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

-- Inicializar estatísticas para usuários existentes se necessário
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users LIMIT 1) AND NOT EXISTS (SELECT 1 FROM user_statistics LIMIT 1) THEN
        INSERT INTO user_statistics (user_id, updated_at)
        SELECT id, CURRENT_TIMESTAMP FROM users;
        
        RAISE NOTICE 'Estatísticas inicializadas para % usuários', (SELECT COUNT(*) FROM users);
    END IF;
END $$;

-- Relatar sucesso
DO $$
BEGIN
    RAISE NOTICE 'Problema da user_statistics corrigido com sucesso!';
    RAISE NOTICE 'Trigger removido para evitar erros durante registro';
    RAISE NOTICE 'Constraint unique verificada/criada';
END $$;