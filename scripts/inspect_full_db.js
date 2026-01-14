
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: 'packages/backend/.env' });

async function inspectDb() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected to database successfully.');

        const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        const tables = res.rows.map(row => row.table_name);

        if (tables.length === 0) {
            console.log('⚠️ No tables found in the public schema.');
        } else {
            console.log(`\n📊 Found ${tables.length} tables. Fetching row counts...\n`);

            let output = '--------------------------------------------------\n';
            output += '| Table Name                     | Row Count     |\n';
            output += '--------------------------------------------------\n';

            for (const table of tables) {
                const countRes = await client.query(`SELECT COUNT(*) FROM "${table}"`);
                const count = countRes.rows[0].count;
                output += `| ${table.padEnd(30)} | ${count.toString().padEnd(13)} |\n`;
            }
            output += '--------------------------------------------------\n';

            fs.writeFileSync('scripts/db_dump.txt', output);
            console.log(output);
            console.log('✅ Dump saved to scripts/db_dump.txt');
        }

        client.release();
    } catch (err) {
        console.error('❌ Error connecting to database:', err);
    } finally {
        await pool.end();
    }
}

inspectDb();
