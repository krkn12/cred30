-- Migração 023: Otimização de Paginação e Busca
-- Descrição: Índices para as novas rotas paginadas do Admin e histórico de usuários

-- 1. Índice para busca textual de usuários no Admin (ajuda no LIKE %...%)
-- O uso de trigram (pg_trgm) seria ideal para buscas parciais, mas usaremos B-TREE simples para LOWER para performance básica
CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 2. Índice para filtragem e ordenação na listagem de usuários
CREATE INDEX IF NOT EXISTS idx_users_admin_list ON users (status, role, created_at DESC);

-- 3. Índice para filtros no histórico financeiro administrativo
CREATE INDEX IF NOT EXISTS idx_admin_logs_finance ON admin_logs (action, created_at DESC);

-- 4. Índice para histórico de transações do usuário (ordenado por data)
-- Já existe idx_transactions_user_type_status, mas um focado em data ajuda o offset massivo
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, created_at DESC);

-- Analyze para atualizar o planejador
ANALYZE users;
ANALYZE admin_logs;
ANALYZE transactions;
