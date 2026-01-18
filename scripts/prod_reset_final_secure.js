
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- RESET FINAL ABSOLUTO ---');

    try {
        // 1. Limpeza de tabelas (Repetindo DELETE para garantir)
        const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const tables = tablesRes.rows.map(r => r.table_name);
        const skip = ['users', 'migrations', 'system_configs', 'system_config'];

        for (let i = 0; i < 3; i++) { // 3 passagens para garantir FKs
            for (const table of tables) {
                if (skip.includes(table)) continue;
                try { await client.query(`DELETE FROM ${table}`); } catch (e) { }
            }
        }

        // 2. Remover outros usuários
        await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);

        // 3. Detectar colunas reais de 'users'
        const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const columns = colRes.rows.map(r => r.column_name);

        const targetUpdates = {
            balance: 0,
            score: 1000,
            membership_type: 'PRO',
            is_verified: true,
            total_borrowed: 0,
            total_repaid: 0,
            xp: 0,
            level: 1,
            seller_total_sales: 0,
            seller_rating: 5.0,
            last_deposit_at: null,
            security_lock_until: null
        };

        let activeUpdates = [];
        for (let col in targetUpdates) {
            if (columns.includes(col)) {
                let val = targetUpdates[col];
                activeUpdates.push(`${col} = ${val === null ? 'NULL' : (typeof val === 'string' ? `'${val}'` : val)}`);
            }
        }

        if (activeUpdates.length > 0) {
            await client.query(`UPDATE users SET ${activeUpdates.join(', ')} WHERE id = $1`, [ADMIN_ID]);
            console.log('✅ Perfil Josias resetado com sucesso.');
        }

        console.log('🚀 DATABASE ZERADO PARA PRODUÇÃO REAL.');

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await client.end();
    }
}
run();
