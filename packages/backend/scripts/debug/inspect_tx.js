
const { Client } = require('pg');

async function inspectTransactions() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('--- RELATÓRIO DE TRANSAÇÕES ---');
        const res = await client.query(`
            SELECT id, type, amount, description, created_at 
            FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 30
        `);

        res.rows.forEach(row => {
            console.log(`[${row.created_at.toISOString()}] ID: ${row.id} | Tipo: ${row.type} | Valor: ${row.amount} | Desc: ${row.description}`);
        });
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

inspectTransactions();
