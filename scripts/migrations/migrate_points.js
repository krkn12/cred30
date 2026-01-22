const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: true
});

async function migrate() {
    try {
        console.log('Iniciando migração de unificação de pontos...');

        // 1. Somar video_points em ad_points
        await pool.query(`
            UPDATE users 
            SET ad_points = COALESCE(ad_points, 0) + COALESCE(video_points, 0)
        `);
        console.log('Passo 1: Pontos de vídeo migrados para ad_points.');

        // 2. Renomear pending_video_points para pending_ad_points se existir
        await pool.query(`
            ALTER TABLE users RENAME COLUMN pending_video_points TO pending_ad_points
        `);
        console.log('Passo 2: Coluna pending_video_points renomeada para pending_ad_points.');

        // 3. Zerar video_points (mantendo a coluna por enquanto para evitar erros de runtime imediatos)
        await pool.query(`
            UPDATE users SET video_points = 0
        `);
        console.log('Passo 3: Coluna video_points zerada.');

        console.log('Migração concluída com sucesso!');
    } catch (err) {
        console.error('Erro na migração:', err);
    } finally {
        await pool.end();
    }
}

migrate();
