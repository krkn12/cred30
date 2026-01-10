const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
// Ajuste para ler da raiz ou do backend conforme necessário
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'postgresql', 'migrations', '034_reward_inventory_system.sql');
        console.log('Reading migration from:', migrationPath);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        const client = await pool.connect();
        try {
            console.log('Aplicando migração 034...');
            await client.query(sql);
            console.log('Migração aplicada com sucesso!');
        } catch (err) {
            console.error('Erro ao aplicar migração:', err);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erro geral:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
