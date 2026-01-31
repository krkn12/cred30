
const { Client } = require('pg');

async function checkDb() {
    const client = new Client({
        connectionString: 'postgresql://admin:admin@localhost:5432/cred30_local'
    });
    try {
        await client.connect();
        const res = await client.query("SELECT id, delivery_status, status FROM marketplace_orders WHERE delivery_status = 'AVAILABLE'");
        console.log(`Encontradas ${res.rows.length} missões disponíveis.`);
        if (res.rows.length > 0) {
            console.log('Exemplos:', res.rows.slice(0, 3));
        }
    } catch (err) {
        console.error('Erro no DB:', err.message);
    } finally {
        await client.end();
    }
}

checkDb();
