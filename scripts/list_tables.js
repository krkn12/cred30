
const { Client } = require('pg');

async function listTables() {
    const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
    const client = new Client({ connectionString: url });

    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
    } catch (err) {
        console.error('❌ Error Listing Tables:', err.message);
    } finally {
        await client.end();
    }
}

listTables();
