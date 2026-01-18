
const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const envContent = fs.readFileSync('packages/backend/.env', 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/)[1].trim();
    const client = new Client({ connectionString: dbUrl });
    const ADMIN_ID = 1;

    await client.connect();
    console.log('--- RESET FINAL DE PRODUÇÃO ---');

    try {
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
        const tables = res.rows.map(r => r.table_name);

        const skip = ['users', 'migrations', 'system_configs', 'system_config'];

        let totalDeleted = 1;
        let pass = 1;
        while (totalDeleted > 0 && pass <= 5) {
            totalDeleted = 0;
            for (const table of tables) {
                if (skip.includes(table)) continue;
                try {
                    const del = await client.query(`DELETE FROM ${table}`);
                    if (del.rowCount > 0) {
                        totalDeleted += del.rowCount;
                        await client.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
                    }
                } catch (e) { }
            }
            pass++;
        }

        // Limpar outros usuários
        await client.query("DELETE FROM users WHERE id != $1", [ADMIN_ID]);

        // Reset administrativo minimalista (apenas campos GARANTIDOS)
        const updateFields = {
            balance: 0,
            score: 1000,
            membership_type: 'PRO',
            is_verified: true,
            last_deposit_at: null,
            xp: 0,
            level: 1
        };

        let setClause = [];
        for (let key in updateFields) {
            setClause.push(`${key} = ${updateFields[key] === null ? 'NULL' : (typeof updateFields[key] === 'string' ? `'${updateFields[key]}'` : updateFields[key])}`);
        }

        await client.query(`UPDATE users SET ${setClause.join(', ')} WHERE id = $1`, [ADMIN_ID]);

        console.log('\n🚀 PRODUÇÃO RESETADA COM SUCESSO!');

    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await client.end();
    }
}
run();
