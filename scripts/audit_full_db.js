
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'packages/backend/.env' });

async function auditDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const reportPath = path.join(__dirname, 'full_db_audit.txt');
    const logStream = fs.createWriteStream(reportPath);

    function log(msg) {
        console.log(msg);
        logStream.write(msg + '\n');
    }

    try {
        const client = await pool.connect();
        log(`[AUDIT START] Checking Database Content at ${new Date().toISOString()}`);
        log('---------------------------------------------------');

        // 1. Get all table names
        const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        const tables = tablesRes.rows.map(r => r.table_name);
        log(`Found ${tables.length} tables.`);

        for (const table of tables) {
            // 2. Count rows
            const countRes = await client.query(`SELECT count(*) FROM "${table}"`);
            const count = parseInt(countRes.rows[0].count, 10);

            log(`\nTABLE: [${table}] - Rows: ${count}`);

            if (count > 0) {
                // 3. Get sample data (up to 3 rows)
                const sampleRes = await client.query(`SELECT * FROM "${table}" LIMIT 3`);
                log(`Sample Data (${sampleRes.rows.length} rows):`);
                sampleRes.rows.forEach(row => {
                    log(JSON.stringify(row, null, 2));
                });
            } else {
                log('  (Empty)');
            }
            log('---------------------------------------------------');
        }

        log('\n[AUDIT COMPLETE]');
        client.release();
    } catch (err) {
        log(`ERROR: ${err.message}`);
    } finally {
        await pool.end();
        logStream.end();
    }
}

auditDatabase();
