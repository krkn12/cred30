
const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-little-cloud-a4c6j16l.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function run() {
    console.log('--- INICIANDO RESTAURAÇÃO DEFINITIVA (HARDCODED URL) ---');
    console.log('Conectando ao banco de dados...');

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const snapshot = JSON.parse(fs.readFileSync('prod_full_snapshot.json', 'utf8'));
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Garante esquemas básicos
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        const tables = Object.keys(snapshot.tables);

        for (const table of tables) {
            const data = snapshot.tables[table];
            if (!data.rows || data.rows.length === 0) {
                console.log(`Tabela ${table}: Sem dados para restaurar.`);
                continue;
            }

            console.log(`Restaurando ${table}... (${data.rows.length} registros)`);

            for (const row of data.rows) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const columns = keys.join(', ');
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

                // Usamos ON CONFLICT (id) DO UPDATE para garantir que os dados fiquem IDÊNTICOS ao backup
                const updates = keys.filter(k => k !== 'id').map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

                try {
                    const query = `
                        INSERT INTO ${table} (${columns}) 
                        VALUES (${placeholders}) 
                        ON CONFLICT (id) DO UPDATE SET ${updates}
                    `;
                    await client.query(query, values);
                } catch (e) {
                    // Se não tiver PK 'id', tenta inserir direto ignorando erro
                    try {
                        await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
                    } catch (e2) {
                        console.warn(`Erro ao inserir na tabela ${table}: ${e2.message}`);
                    }
                }
            }

            // Resetar sequence
            try {
                await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
            } catch (e) { }
        }

        await client.query('COMMIT');
        console.log('--- RESTAURAÇÃO CONCLUÍDA ---');

        // Verificação final
        console.log('\n--- VERIFICAÇÃO DE DADOS ---');
        for (const table of tables) {
            try {
                const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`${table}: ${res.rows[0].count} registros.`);
            } catch (e) { }
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERRO CRÍTICO NA RESTAURAÇÃO:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
