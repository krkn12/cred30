-- Script para corrigir o problema com o trigger da user_statistics
-- O erro ocorre porque não há constraint unique na tabela user_statistics

-- Primeiro, remover o trigger existente
DROP TRIGGER IF EXISTS trigger_update_user_statistics ON users;
DROP FUNCTION IF EXISTS update_user_statistics();

-- Adicionar constraint unique na tabela user_statistics se não existir
ALTER TABLE user_statistics ADD CONSTRAINT IF NOT EXISTS user_statistics_user_id_unique UNIQUE (user_id);

-- Recriar a função do trigger com tratamento melhor
CREATE OR REPLACE FUNCTION update_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_statistics (user_id, updated_at)
        VALUES (NEW.id, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE user_statistics SET
            updated_at = CURRENT_TIMESTAMP,
            last_activity_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Recriar o trigger
CREATE TRIGGER trigger_update_user_statistics
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_statistics();

-- Verificar se a tabela está vazia e inicializar se necessário
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM user_statistics LIMIT 1) THEN
        -- Inicializar estatísticas para todos os usuários existentes
        INSERT INTO user_statistics (user_id, updated_at)
        SELECT id, CURRENT_TIMESTAMP FROM users
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Estatísticas inicializadas para % usuários', (SELECT COUNT(*) FROM users);
    END IF;
END $$;

-- Relatar sucesso
DO $$
BEGIN
    RAISE NOTICE 'Trigger user_statistics corrigido com sucesso!';
    RAISE NOTICE 'Constraint unique adicionada em user_statistics.user_id';
END $$;