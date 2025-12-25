-- Migration: 012_final_optimization.sql
-- Data: 25/12/2024
-- Descrição: Otimização final do banco de dados para produção

-- ============================================
-- 1. ÍNDICES COMPOSTOS PARA QUERIES CRÍTICAS
-- ============================================

-- Feed de vídeos: ativos, aprovados, com budget disponível
CREATE INDEX IF NOT EXISTS idx_promo_videos_feed 
ON promo_videos(is_active, is_approved, status, budget, spent)
WHERE is_active = TRUE AND is_approved = TRUE AND status = 'ACTIVE';

-- Campanhas do usuário com ordenação por data
CREATE INDEX IF NOT EXISTS idx_promo_videos_user_campaigns 
ON promo_videos(user_id, created_at DESC);

-- Views de um vídeo específico (para calcular ganhos)
CREATE INDEX IF NOT EXISTS idx_promo_views_video_completed 
ON promo_video_views(video_id, completed, earned)
WHERE completed = TRUE;

-- Ganhos de um usuário (para dashboard)
CREATE INDEX IF NOT EXISTS idx_promo_views_user_earnings 
ON promo_video_views(viewer_id, earned, paid_at)
WHERE completed = TRUE;

-- ============================================
-- 2. ÍNDICES PARA TRANSAÇÕES FREQUENTES
-- ============================================

-- Transações pendentes de saque (admin queue)
CREATE INDEX IF NOT EXISTS idx_transactions_pending_withdrawal 
ON transactions(type, status, created_at DESC)
WHERE type = 'WITHDRAWAL' AND status = 'PENDING';

-- Depósitos recentes (para reconciliação)
CREATE INDEX IF NOT EXISTS idx_transactions_deposits_recent 
ON transactions(type, created_at DESC)
WHERE type = 'DEPOSIT' AND status = 'APPROVED';

-- External payment ID para webhooks
CREATE INDEX IF NOT EXISTS idx_transactions_external_payment 
ON transactions(external_payment_id)
WHERE external_payment_id IS NOT NULL;

-- ============================================
-- 3. ÍNDICES PARA EMPRÉSTIMOS
-- ============================================

-- Empréstimos pendentes de aprovação
CREATE INDEX IF NOT EXISTS idx_loans_pending_approval 
ON loans(status, created_at DESC)
WHERE status = 'PENDING';

-- Empréstimos atrasados para cobrança automática
CREATE INDEX IF NOT EXISTS idx_loans_overdue_collection 
ON loans(due_date, status, total_repayment, total_paid)
WHERE status IN ('APPROVED', 'PAYMENT_PENDING') AND due_date < NOW();

-- ============================================
-- 4. ÍNDICES PARA USUÁRIOS
-- ============================================

-- Busca por email (login)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON users(LOWER(email));

-- Usuários PRO ativos
CREATE INDEX IF NOT EXISTS idx_users_pro_active 
ON users(membership_type, status)
WHERE membership_type = 'PRO' AND status = 'ACTIVE';

-- Ranking por score (leaderboard)
CREATE INDEX IF NOT EXISTS idx_users_leaderboard 
ON users(score DESC, balance DESC)
WHERE status = 'ACTIVE';

-- ============================================
-- 5. ÍNDICES PARA COTAS
-- ============================================

-- Cotas ativas por valor (para dividendos)
CREATE INDEX IF NOT EXISTS idx_quotas_active_value 
ON quotas(user_id, current_value)
WHERE status = 'ACTIVE';

-- Total investido por usuário
CREATE INDEX IF NOT EXISTS idx_quotas_user_total 
ON quotas(user_id, purchase_price)
WHERE status = 'ACTIVE';

-- ============================================
-- 6. CONFIGURAÇÕES DE AUTOVACUUM
-- ============================================

-- Tabelas de alta escrita: configurar autovacuum mais agressivo
ALTER TABLE transactions SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE promo_video_views SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE quotas SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- ============================================
-- 7. ATUALIZAR ESTATÍSTICAS
-- ============================================

ANALYZE users;
ANALYZE transactions;
ANALYZE loans;
ANALYZE quotas;
ANALYZE promo_videos;
ANALYZE promo_video_views;
ANALYZE products;
ANALYZE notifications;

-- ============================================
-- 8. VACUUM PARA RECUPERAR ESPAÇO
-- ============================================

-- Executar apenas em manutenção programada
-- VACUUM ANALYZE;

-- ============================================
-- 9. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================

COMMENT ON INDEX idx_promo_videos_feed IS 'Índice para feed de vídeos disponíveis para assistir';
COMMENT ON INDEX idx_transactions_pending_withdrawal IS 'Índice para fila de saques pendentes no admin';
COMMENT ON INDEX idx_loans_overdue_collection IS 'Índice para empréstimos atrasados para cobrança';
COMMENT ON INDEX idx_users_pro_active IS 'Índice para usuários PRO ativos (sem anúncios)';
