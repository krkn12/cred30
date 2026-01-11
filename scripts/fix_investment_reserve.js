const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

const QUOTA_SHARE_VALUE = 42.00;

console.log('🔧 Iniciando Correção da Reserva de Investimentos...\n');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixReserve() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Contar Cotas Ativas
        const quotasRes = await client.query("SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE'");
        const activeQuotas = parseInt(quotasRes.rows[0].count);

        // 2. Calcular Valor Esperado (Lastro)
        const expectedReserve = activeQuotas * QUOTA_SHARE_VALUE;

        // 3. Pegar Valor Atual
        const configRes = await client.query('SELECT investment_reserve FROM system_config LIMIT 1 FOR UPDATE');
        const currentReserve = parseFloat(configRes.rows[0]?.investment_reserve || '0');

        console.log(`📊 Diagnóstico:`);
        console.log(`- Cotas Ativas: ${activeQuotas}`);
        console.log(`- Valor por Cota (Lastro): R$ ${QUOTA_SHARE_VALUE.toFixed(2)}`);
        console.log(`- Reserva Esperada (Mínima): R$ ${expectedReserve.toFixed(2)}`);
        console.log(`- Reserva Atual: R$ ${currentReserve.toFixed(2)}`);

        // 4. Calcular Diferença
        const difference = expectedReserve - currentReserve;

        if (difference > 0.01) {
            console.log(`\n⚠️  DIFERENÇA ENCONTRADA: R$ ${difference.toFixed(2)} faltando.`);
            console.log('🔄 Corrigindo...');

            await client.query('UPDATE system_config SET investment_reserve = investment_reserve + $1', [difference]);

            // Logar ação
            await client.query(`
                INSERT INTO admin_logs (admin_id, action, target_id, new_values)
                VALUES ($1, 'FIX_RESERVE_BUG', 'SYSTEM', $2)
            `, [
                (await client.query('SELECT id FROM users WHERE is_admin = true LIMIT 1')).rows[0]?.id, // Pegar primeiro admin
                JSON.stringify({
                    message: "Correção automática de lastro de cotas (Bug Fix)",
                    addedAmount: difference,
                    activeQuotas,
                    previousReserve: currentReserve,
                    newReserve: expectedReserve
                })
            ]);

            console.log('✅ CORREÇÃO APLICADA COM SUCESSO!');
            console.log(`Nova Reserva: R$ ${expectedReserve.toFixed(2)}`);
        } else {
            console.log('\n✅ Nenhuma correção necessária. O lastro está correto ou superior.');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ ERRO:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixReserve();
