
const { Client } = require('pg');

async function checkDb() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/cred30'
        // Tentando credenciais padrão se o .env não estiver acessível facilmente aqui
    });
    try {
        await client.connect();
        console.log('Conectado ao DB.');

        const res = await client.query(`
            SELECT o.id, o.delivery_status, o.status 
            FROM marketplace_orders o
            WHERE o.delivery_status = 'AVAILABLE'
              AND o.status = 'WAITING_SHIPPING'
        `);

        console.log(`Encontradas ${res.rows.length} missões disponíveis.`);
        if (res.rows.length > 0) {
            console.log('Exemplos:', res.rows);
        } else {
            console.log('Nenhuma missão encontrada com os critérios.');
            const anyOrder = await client.query("SELECT delivery_status, status FROM marketplace_orders LIMIT 5");
            console.log('Amostra de outros pedidos:', anyOrder.rows);
        }
    } catch (err) {
        console.error('ERRO DETALHADO NO DB:', err);
    } finally {
        await client.end();
    }
}

checkDb();
