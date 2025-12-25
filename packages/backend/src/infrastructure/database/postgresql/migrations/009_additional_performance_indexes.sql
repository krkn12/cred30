-- Migração 009: Índices Adicionais de Performance
-- Data: 25/12/2024
-- Descrição: Índices estratégicos para queries frequentes do dashboard e operações financeiras

-- 1. Índice composto para filtro de transações do usuário por tipo e status
-- Usado em: histórico de transações, relatórios
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status 
ON transactions(user_id, type, status);

-- 2. Índice parcial para cotas elegíveis para dividendo (apenas ACTIVE)
-- Usado em: distribuição de lucros diária
CREATE INDEX IF NOT EXISTS idx_quotas_eligible_dividend 
ON quotas(status, user_id) WHERE status = 'ACTIVE';

-- 3. Índice para ordenação de fila de pagamento PIX
-- Usado em: admin payout queue, priorização de saques
CREATE INDEX IF NOT EXISTS idx_payout_queue_priority 
ON transactions(payout_status, created_at) 
WHERE payout_status = 'PENDING_PAYMENT';

-- 4. Índice para busca rápida de empréstimos atrasados (liquidação)
-- Usado em: auto-liquidation service diário
CREATE INDEX IF NOT EXISTS idx_loans_overdue 
ON loans(due_date, status) 
WHERE status IN ('APPROVED', 'PAYMENT_PENDING');

-- 5. Índice para usuários por score (ranking e priorização)
-- Usado em: fila de desembolso, ranking de membros
CREATE INDEX IF NOT EXISTS idx_users_score_ranking 
ON users(score DESC NULLS LAST, created_at);

-- 6. Índice para notificações não lidas por usuário
-- Usado em: badge de notificações, listagem
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, read_at) 
WHERE read_at IS NULL;

-- 7. Índice para transações recentes (últimas 24h para métricas)
-- Usado em: dashboard metrics, relatórios de atividade
CREATE INDEX IF NOT EXISTS idx_transactions_recent 
ON transactions(created_at DESC) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 8. Índice para marketplace - produtos ativos por categoria
-- Usado em: listagem de produtos, filtros
CREATE INDEX IF NOT EXISTS idx_products_active_category 
ON products(status, category, created_at DESC) 
WHERE status = 'ACTIVE';

-- 9. Índice para votações ativas
-- Usado em: listagem de propostas, votação
CREATE INDEX IF NOT EXISTS idx_proposals_active 
ON voting_proposals(status, end_date) 
WHERE status = 'ACTIVE';

-- 10. Índice para audit logs por entidade (debug e auditoria)
-- Usado em: histórico de ações por registro
CREATE INDEX IF NOT EXISTS idx_audit_entity_lookup 
ON admin_logs(entity_type, entity_id, created_at DESC);

-- Atualizar estatísticas do planner
ANALYZE users;
ANALYZE transactions;
ANALYZE loans;
ANALYZE quotas;
ANALYZE notifications;
ANALYZE products;
ANALYZE voting_proposals;
