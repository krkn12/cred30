
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_ODLh9Hdv7eZR@ep-mute-math-ahw4pcdb.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function checkSchema() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('--- COLUNAS DA TABELA LOANS ---');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'loans'
        `);
        res.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}`));
    } catch (err) {
        console.error('ERRO:', err.message);
    } finally {
        await client.end();
    }
}

checkSchema();
