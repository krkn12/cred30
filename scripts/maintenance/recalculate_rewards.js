const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

// Taxa de conversão global (1000 pts = R$ 1,00)
const POINTS_CONVERSION_RATE = 1000;

async function recalculateRewardPoints() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Recalculando pontos do catálogo de recompensas...');

        // Recalcula points_cost = value * POINTS_CONVERSION_RATE
        const result = await pool.query(`
            UPDATE reward_catalog 
            SET points_cost = ROUND(value * $1)
            RETURNING id, name, value, points_cost
        `, [POINTS_CONVERSION_RATE]);

        console.log(`✅ Catálogo atualizado! ${result.rowCount} recompensas recalculadas.`);
        console.table(result.rows.map(r => ({
            ID: r.id,
            Nome: r.name,
            'Valor (R$)': r.value,
            'Pontos (Novo)': r.points_cost
        })));

    } catch (error) {
        console.error('❌ Erro ao recalcular catálogo:', error);
    } finally {
        await pool.end();
    }
}

recalculateRewardPoints();
