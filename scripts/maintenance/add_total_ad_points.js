const { Pool } = require('pg');

async function migrate() {
    const pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
        ssl: true
    });

    try {
        console.log('🚀 Iniciando migração: Adicionando total_ad_points...');

        // 1. Adicionar a coluna total_ad_points
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ad_points INTEGER DEFAULT 0');
        console.log('✅ Coluna total_ad_points adicionada.');

        // 2. Inicializar total_ad_points com os pontos atuais de ad_points
        await pool.query('UPDATE users SET total_ad_points = COALESCE(ad_points, 0) WHERE total_ad_points = 0 OR total_ad_points IS NULL');
        console.log('✅ total_ad_points inicializado com valores de ad_points.');

        console.log('🎊 Migração concluída com sucesso!');
    } catch (err) {
        console.error('❌ Erro na migração:', err);
    } finally {
        await pool.end();
    }
}

migrate();
