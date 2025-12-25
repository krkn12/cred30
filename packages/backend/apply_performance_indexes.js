// Script para aplicar os índices de performance no banco de dados
// Execute com: node apply_performance_indexes.js

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'cred30_local'
    };

const pool = new Pool(poolConfig);

const indexes = [
    // 1. Índice composto para filtro de transações do usuário por tipo e status
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status ON transactions(user_id, type, status)`,

    // 2. Índice parcial para cotas elegíveis para dividendo (apenas ACTIVE)
    `CREATE INDEX IF NOT EXISTS idx_quotas_eligible_dividend ON quotas(status, user_id) WHERE status = 'ACTIVE'`,

    // 3. Índice para ordenação de fila de pagamento PIX
    `CREATE INDEX IF NOT EXISTS idx_payout_queue_priority ON transactions(payout_status, created_at) WHERE payout_status = 'PENDING_PAYMENT'`,

    // 4. Índice para busca rápida de empréstimos atrasados (liquidação)
    `CREATE INDEX IF NOT EXISTS idx_loans_overdue ON loans(due_date, status) WHERE status IN ('APPROVED', 'PAYMENT_PENDING')`,

    // 5. Índice para usuários por score (ranking e priorização)
    `CREATE INDEX IF NOT EXISTS idx_users_score_ranking ON users(score DESC NULLS LAST, created_at)`,

    // 6. Índice para notificações não lidas por usuário
    `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL`,

    // 7. Índice para marketplace - produtos ativos por categoria
    `CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(status, category, created_at DESC) WHERE status = 'ACTIVE'`,

    // 8. Índice para votações ativas
    `CREATE INDEX IF NOT EXISTS idx_proposals_active ON voting_proposals(status, end_date) WHERE status = 'ACTIVE'`,

    // 9. Índice para audit logs por entidade (debug e auditoria)
    `CREATE INDEX IF NOT EXISTS idx_audit_entity_lookup ON admin_logs(entity_type, entity_id, created_at DESC)`,
];

async function applyIndexes() {
    console.log('🚀 Aplicando índices de performance...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const sql of indexes) {
        const indexName = sql.match(/idx_\w+/)?.[0] || 'unknown';
        try {
            await pool.query(sql);
            console.log(`✅ ${indexName} criado/verificado`);
            successCount++;
        } catch (error) {
            console.error(`❌ ${indexName} falhou:`, error.message);
            errorCount++;
        }
    }

    // Atualizar estatísticas
    console.log('\n📊 Atualizando estatísticas do banco...');
    try {
        await pool.query('ANALYZE users');
        await pool.query('ANALYZE transactions');
        await pool.query('ANALYZE loans');
        await pool.query('ANALYZE quotas');
        await pool.query('ANALYZE notifications');
        await pool.query('ANALYZE products');
        await pool.query('ANALYZE voting_proposals');
        console.log('✅ Estatísticas atualizadas');
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error.message);
    }

    console.log(`\n📋 Resumo: ${successCount} sucesso, ${errorCount} erros`);

    await pool.end();
    process.exit(0);
}

applyIndexes().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
