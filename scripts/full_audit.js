require('dotenv').config({ path: 'packages/backend/.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function safeQuery(query, params = []) {
    try {
        const res = await pool.query(query, params);
        return res.rows;
    } catch (err) {
        console.log(`  [ERRO SQL] ${err.message}`);
        return null;
    }
}

async function auditDatabase() {
    const report = { timestamp: new Date().toISOString(), tables: {}, financials: {}, issues: [] };

    try {
        console.log('📊 AUDITORIA COMPLETA - BANCO DE DADOS CRED30');
        console.log('==============================================\n');

        // 1. TABELAS
        console.log('📋 TABELAS E REGISTROS:');
        const tables = await safeQuery(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
        `);
        if (tables) {
            for (const t of tables) {
                const cnt = await safeQuery(`SELECT COUNT(*) as c FROM "${t.table_name}"`);
                const count = cnt ? parseInt(cnt[0].c) : 'ERRO';
                report.tables[t.table_name] = count;
                console.log(`  ${t.table_name.padEnd(32)} ${count}`);
            }
        }

        // 2. USUÁRIOS
        console.log('\n👥 USUÁRIOS:');
        const users = await safeQuery(`
            SELECT COUNT(*) as total, COALESCE(SUM(balance), 0) as balance,
            COUNT(*) FILTER (WHERE is_seller = true) as sellers,
            COUNT(*) FILTER (WHERE role = 'ADMIN') as admins
            FROM users
        `);
        if (users && users[0]) {
            console.log(`  Total: ${users[0].total}`);
            console.log(`  Saldo Total: R$ ${parseFloat(users[0].balance).toFixed(2)}`);
            console.log(`  Vendedores: ${users[0].sellers}`);
            console.log(`  Admins: ${users[0].admins}`);
            report.financials.users = users[0];
        }

        // 3. SYSTEM CONFIG
        console.log('\n💰 SYSTEM CONFIG:');
        const sys = await safeQuery('SELECT * FROM system_config LIMIT 1');
        if (sys && sys[0]) {
            const s = sys[0];
            console.log(`  system_balance:           R$ ${parseFloat(s.system_balance || 0).toFixed(2)}`);
            console.log(`  investment_reserve:       R$ ${parseFloat(s.investment_reserve || 0).toFixed(2)}`);
            console.log(`  profit_pool:              R$ ${parseFloat(s.profit_pool || 0).toFixed(2)}`);
            console.log(`  total_tax_reserve:        R$ ${parseFloat(s.total_tax_reserve || 0).toFixed(2)}`);
            console.log(`  total_operational_reserve: R$ ${parseFloat(s.total_operational_reserve || 0).toFixed(2)}`);
            console.log(`  total_owner_profit:       R$ ${parseFloat(s.total_owner_profit || 0).toFixed(2)}`);
            report.financials.systemConfig = s;
        }

        // 4. TRANSAÇÕES
        console.log('\n📈 TRANSAÇÕES:');
        const txs = await safeQuery(`
            SELECT type, status, COUNT(*) as c, COALESCE(SUM(amount::numeric), 0) as total
            FROM transactions GROUP BY type, status ORDER BY type
        `);
        if (txs) {
            for (const tx of txs) {
                console.log(`  ${(tx.type || '?').padEnd(18)} [${(tx.status || '?').padEnd(8)}] ${String(tx.c).padStart(3)} tx, R$ ${parseFloat(tx.total).toFixed(2)}`);
            }
            report.financials.transactions = txs;
        }

        // 5. EMPRÉSTIMOS
        console.log('\n💳 EMPRÉSTIMOS:');
        const loans = await safeQuery(`
            SELECT status, COUNT(*) as c, COALESCE(SUM(principal), 0) as principal
            FROM loans GROUP BY status
        `);
        if (loans) {
            for (const l of loans) {
                console.log(`  ${(l.status || '?').padEnd(15)} ${l.c} emp., Principal: R$ ${parseFloat(l.principal).toFixed(2)}`);
            }
            report.financials.loans = loans;
        }

        // Empréstimos ativos
        const active = await safeQuery(`
            SELECT l.id, u.name, l.principal, l.status,
                   l.total_repayment - COALESCE((SELECT SUM(amount) FROM loan_installments WHERE loan_id = l.id), 0) as remaining
            FROM loans l JOIN users u ON l.user_id = u.id
            WHERE l.status IN ('APPROVED', 'PAYMENT_PENDING')
        `);
        if (active && active.length > 0) {
            console.log('\n  📌 Ativos:');
            for (const a of active) {
                console.log(`     #${a.id} ${a.name}: R$ ${parseFloat(a.remaining).toFixed(2)} restando [${a.status}]`);
            }
        }

        // 6. COTAS
        console.log('\n🎫 COTAS:');
        const quotas = await safeQuery(`SELECT status, COUNT(*) as c, COALESCE(SUM(price), 0) as val FROM quotas GROUP BY status`);
        if (quotas) {
            for (const q of quotas) {
                console.log(`  ${(q.status || '?').padEnd(12)} ${q.c} cotas, R$ ${parseFloat(q.val).toFixed(2)}`);
            }
        }

        // 7. MARKETPLACE
        console.log('\n🛒 MARKETPLACE:');
        const listings = await safeQuery(`SELECT status, COUNT(*) as c FROM marketplace_listings GROUP BY status`);
        if (listings) {
            console.log('  Anúncios:');
            for (const l of listings) console.log(`    ${(l.status || '?').padEnd(12)} ${l.c}`);
        }
        const orders = await safeQuery(`SELECT status, COUNT(*) as c, COALESCE(SUM(amount::numeric), 0) as t FROM marketplace_orders GROUP BY status`);
        if (orders) {
            console.log('  Pedidos:');
            for (const o of orders) console.log(`    ${(o.status || '?').padEnd(15)} ${o.c} ped., R$ ${parseFloat(o.t).toFixed(2)}`);
        }

        // 8. INCONSISTÊNCIAS
        console.log('\n⚠️ VERIFICAÇÕES:');
        const neg = await safeQuery(`SELECT id, name, balance FROM users WHERE balance < 0`);
        if (neg && neg.length > 0) {
            console.log(`  ❌ ${neg.length} usuários com saldo NEGATIVO`);
            report.issues.push({ type: 'NEGATIVE_BALANCE', users: neg });
        } else {
            console.log('  ✅ Nenhum saldo negativo');
        }

        const paid = await safeQuery(`
            SELECT l.id, l.total_repayment - COALESCE((SELECT SUM(amount) FROM loan_installments WHERE loan_id = l.id), 0) as r
            FROM loans l WHERE l.status = 'PAID'
            HAVING l.total_repayment - COALESCE((SELECT SUM(amount) FROM loan_installments WHERE loan_id = l.id), 0) > 0.02
        `);
        if (paid && paid.length > 0) {
            console.log(`  ⚠️ ${paid.length} emp. PAID com saldo > R$ 0.02`);
            report.issues.push({ type: 'PAID_WITH_BALANCE', loans: paid });
        } else {
            console.log('  ✅ Empréstimos PAID OK');
        }

        // SALVAR
        fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
        console.log('\n✅ Relatório salvo em audit_report.json');

    } catch (err) {
        console.error('❌ ERRO FATAL:', err.message);
    } finally {
        await pool.end();
    }
}

auditDatabase();
