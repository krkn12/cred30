const { Client } = require('pg');

const c = new Client('postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
    await c.connect();

    // Listar tabelas
    const tables = await c.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `);

    console.log('📊 TABELAS NO BANCO:');
    tables.rows.forEach(r => console.log('  - ' + r.table_name));

    console.log('\n📈 CONTAGENS:');
    const mainTables = ['users', 'quotas', 'loans', 'transactions', 'marketplace_listings', 'marketplace_orders', 'bug_reports', 'proposals', 'reviews', 'investments'];

    for (const t of mainTables) {
        try {
            const count = await c.query(`SELECT COUNT(*) FROM ${t}`);
            console.log(`  ${t}: ${count.rows[0].count} registros`);
        } catch (e) {
            console.log(`  ${t}: (tabela não existe)`);
        }
    }

    // Resumo de usuários
    console.log('\n👥 USUÁRIOS:');
    const users = await c.query(`SELECT id, name, email, role, balance, score, is_seller, is_courier, created_at FROM users ORDER BY id LIMIT 20`);
    users.rows.forEach(u => {
        console.log(`  [${u.id}] ${u.name} | ${u.email} | ${u.role} | R$ ${u.balance} | Score: ${u.score} | Seller: ${u.is_seller} | Courier: ${u.is_courier}`);
    });

    await c.end();
}

main().catch(e => console.log('Erro:', e.message));
