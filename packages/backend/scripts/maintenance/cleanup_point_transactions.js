
const { Client } = require('pg');

async function cleanupPointTransactions() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('--- Iniciando Saneamento de Transações de Pontos ---');

        // Deletar transações que na verdade são pontos e não reais
        const res = await client.query(`
            DELETE FROM transactions 
            WHERE type IN ('CHEST_REWARD', 'VIDEO_REWARD')
            RETURNING id, type, amount, description;
        `);

        console.log(`✅ Sucesso! ${res.rowCount} transações de pontos removidas do extrato financeiro.`);
        if (res.rowCount > 0) {
            console.table(res.rows);
        }
    } catch (err) {
        console.error('❌ Erro no saneamento:', err);
    } finally {
        await client.end();
    }
}

cleanupPointTransactions();
