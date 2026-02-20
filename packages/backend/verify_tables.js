// Script de verificação rápida: checa se as tabelas críticas existem no banco
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        const tables = result.rows.map(r => r.table_name);
        console.log('\n📋 Tabelas encontradas no banco (' + tables.length + ' total):\n');
        tables.forEach(t => console.log('  -', t));

        // Verificar tabelas críticas
        const criticas = ['pdv_subscriptions', 'pdv_devices', 'pdv_products', 'pdv_sales', 'pdv_sale_items',
            'notifications', 'governance_proposals', 'governance_votes',
            'consortium_groups', 'consortium_members', 'audit_logs', 'webhook_logs'];

        console.log('\n🔍 Status das tabelas críticas:');
        for (const t of criticas) {
            const existe = tables.includes(t);
            console.log(`  ${existe ? '✅' : '❌'} ${t}`);
        }
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
