const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function fixRanking() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Iniciando sincronização de pontos para o ranking...');

        // Sincronizar total_ad_points com ad_points onde ad_points for maior
        // Isso recupera pontos ganhos via baú/ads que não foram vitalizados
        const result = await pool.query(`
            UPDATE users 
            SET total_ad_points = GREATEST(COALESCE(total_ad_points, 0), COALESCE(ad_points, 0))
            WHERE COALESCE(ad_points, 0) > COALESCE(total_ad_points, 0)
            RETURNING id, name, ad_points, total_ad_points
        `);

        console.log(`✅ Sincronização concluída! ${result.rowCount} usuários atualizados.`);

        if (result.rowCount > 0) {
            console.table(result.rows.map(r => ({
                Nome: r.name,
                'Pontos Saldo': r.ad_points,
                'Pontos Ranking (Novo)': r.total_ad_points
            })));
        }

    } catch (error) {
        console.error('❌ Erro ao sincronizar ranking:', error);
    } finally {
        await pool.end();
    }
}

fixRanking();
