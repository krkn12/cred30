const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-mute-math-ahw4pcdb.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: databaseUrl,
});

async function dumpDatabase() {
    console.log('Starting full database dump...');
    const client = await pool.connect();
    const dump = {};

    try {
        // 1. Get all table names
        const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        const tables = tablesRes.rows.map(row => row.table_name);
        console.log(`Found ${tables.length} tables:`, tables.join(', '));

        // 2. Fetch data for each table
        for (const table of tables) {
            console.log(`Fetching data for table: ${table}...`);
            const dataRes = await client.query(`SELECT * FROM "${table}"`);
            dump[table] = dataRes.rows;
        }

        // 3. Save to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `db_dump_${timestamp}.json`;
        const outputPath = path.join(__dirname, filename);

        fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));
        console.log(`\n✅ Database dump saved successfully to:\n${outputPath}`);
        console.log(`Total tables dumped: ${Object.keys(dump).length}`);

    } catch (err) {
        console.error('Dump failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

dumpDatabase();
