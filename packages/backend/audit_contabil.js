/**
 * Script de Auditoria Contábil — Cred30
 * Puxa todas as tabelas financeiras para identificar inconsistências
 */
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_r2ONaiq8dpRW@ep-divine-surf-ai9icfnr.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
});

async function audit() {
    const client = await pool.connect();
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 AUDITORIA CONTÁBIL CRED30');
        console.log('='.repeat(70));

        // 1. SALDOS DOS USUÁRIOS
        console.log('\n📊 1. SALDOS DOS USUÁRIOS');
        console.log('-'.repeat(50));
        const users = await client.query(`
            SELECT id, name, balance::numeric, score, role, is_seller 
            FROM users ORDER BY id
        `);
        let totalUserBalances = 0;
        users.rows.forEach(u => {
            const bal = parseFloat(u.balance);
            totalUserBalances += bal;
            console.log(`  ID=${u.id} | ${u.name} | Saldo: R$ ${bal.toFixed(2)} | Score: ${u.score} | Role: ${u.role} | Seller: ${u.is_seller}`);
        });
        console.log(`\n  💰 TOTAL SALDOS USUÁRIOS: R$ ${totalUserBalances.toFixed(2)}`);

        // 2. RESERVAS DO SISTEMA (system_config)
        console.log('\n\n📊 2. RESERVAS DO SISTEMA (system_config)');
        console.log('-'.repeat(50));
        const sysConfig = await client.query(`
            SELECT key, value FROM system_config 
            WHERE key IN (
                'system_balance', 'tax_reserve', 'operational_reserve', 
                'owner_reserve', 'stability_fund', 'corporate_investment',
                'total_fees_collected', 'total_platform_revenue'
            ) ORDER BY key
        `);
        let totalReserves = 0;
        sysConfig.rows.forEach(r => {
            const val = parseFloat(r.value) || 0;
            if (['tax_reserve', 'operational_reserve', 'owner_reserve', 'stability_fund', 'corporate_investment'].includes(r.key)) {
                totalReserves += val;
            }
            console.log(`  ${r.key}: R$ ${val.toFixed(2)}`);
        });
        console.log(`\n  💰 TOTAL RESERVAS (5 pools): R$ ${totalReserves.toFixed(2)}`);

        // 3. TRANSAÇÕES (transactions)
        console.log('\n\n📊 3. TODAS AS TRANSAÇÕES');
        console.log('-'.repeat(50));
        const transactions = await client.query(`
            SELECT id, user_id, type, amount::numeric, description, status, created_at
            FROM transactions ORDER BY created_at ASC
        `);
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let totalFees = 0;
        transactions.rows.forEach(t => {
            const amt = parseFloat(t.amount);
            const date = new Date(t.created_at).toLocaleString('pt-BR');
            console.log(`  #${t.id} | User=${t.user_id} | ${t.type} | R$ ${amt.toFixed(2)} | ${t.status} | ${t.description || ''} | ${date}`);

            if (t.type === 'DEPOSIT' && t.status === 'COMPLETED') totalDeposits += amt;
            if (t.type === 'WITHDRAWAL' && t.status === 'COMPLETED') totalWithdrawals += amt;
            if (t.type === 'FEE' || t.type === 'PLATFORM_FEE') totalFees += amt;
        });
        console.log(`\n  📥 TOTAL DEPÓSITOS: R$ ${totalDeposits.toFixed(2)}`);
        console.log(`  📤 TOTAL SAQUES: R$ ${totalWithdrawals.toFixed(2)}`);
        console.log(`  🏷️  TOTAL TAXAS: R$ ${totalFees.toFixed(2)}`);

        // 4. VENDAS PDV
        console.log('\n\n📊 4. VENDAS PDV');
        console.log('-'.repeat(50));
        const sales = await client.query(`
            SELECT id, user_id, sale_number, total::numeric, payment_method, 
                   customer_name, change_amount::numeric, created_at
            FROM pdv_sales ORDER BY created_at ASC
        `);
        let totalSales = 0;
        sales.rows.forEach(s => {
            const total = parseFloat(s.total);
            totalSales += total;
            const date = new Date(s.created_at).toLocaleString('pt-BR');
            console.log(`  Venda #${s.sale_number} | User=${s.user_id} | R$ ${total.toFixed(2)} | ${s.payment_method} | Cliente: ${s.customer_name || 'N/A'} | Troco: R$ ${parseFloat(s.change_amount || 0).toFixed(2)} | ${date}`);
        });
        console.log(`\n  🛒 TOTAL VENDAS PDV: R$ ${totalSales.toFixed(2)}`);

        // 5. EMPRÉSTIMOS (loans)
        console.log('\n\n📊 5. EMPRÉSTIMOS');
        console.log('-'.repeat(50));
        const loans = await client.query(`
            SELECT id, user_id, amount::numeric, total_with_interest::numeric, 
                   status, installments, origin, created_at
            FROM loans ORDER BY created_at ASC
        `);
        let totalLoansActive = 0;
        loans.rows.forEach(l => {
            const amt = parseFloat(l.amount);
            const total = parseFloat(l.total_with_interest);
            if (l.status === 'APPROVED' || l.status === 'ACTIVE') totalLoansActive += amt;
            const date = new Date(l.created_at).toLocaleString('pt-BR');
            console.log(`  Emp #${l.id} | User=${l.user_id} | R$ ${amt.toFixed(2)} (total c/ juros: R$ ${total.toFixed(2)}) | ${l.installments}x | ${l.status} | origin: ${l.origin || 'N/A'} | ${date}`);
        });
        console.log(`\n  📋 TOTAL EMPRÉSTIMOS ATIVOS: R$ ${totalLoansActive.toFixed(2)}`);

        // 6. COTAS (quotas)
        console.log('\n\n📊 6. COTAS');
        console.log('-'.repeat(50));
        const quotas = await client.query(`
            SELECT id, user_id, amount::numeric, status, created_at
            FROM quotas ORDER BY created_at ASC
        `);
        let totalQuotas = 0;
        quotas.rows.forEach(q => {
            const amt = parseFloat(q.amount);
            if (q.status === 'ACTIVE') totalQuotas += amt;
            const date = new Date(q.created_at).toLocaleString('pt-BR');
            console.log(`  Cota #${q.id} | User=${q.user_id} | R$ ${amt.toFixed(2)} | ${q.status} | ${date}`);
        });
        console.log(`\n  📋 TOTAL COTAS ATIVAS: R$ ${totalQuotas.toFixed(2)}`);

        // 7. RESUMO FINAL — AUDITORIA
        console.log('\n\n' + '='.repeat(70));
        console.log('📋 RESUMO DA AUDITORIA');
        console.log('='.repeat(70));
        console.log(`  📥 Entrada no sistema (depósitos):    R$ ${totalDeposits.toFixed(2)}`);
        console.log(`  📤 Saída do sistema (saques):         R$ ${totalWithdrawals.toFixed(2)}`);
        console.log(`  👥 Total em saldos de usuários:       R$ ${totalUserBalances.toFixed(2)}`);
        console.log(`  🏛️  Total em reservas (5 pools):       R$ ${totalReserves.toFixed(2)}`);
        console.log(`  📋 Total em cotas ativas:             R$ ${totalQuotas.toFixed(2)}`);
        console.log(`  💳 Total empréstimos ativos:          R$ ${totalLoansActive.toFixed(2)}`);
        console.log(`  🛒 Total vendas PDV:                  R$ ${totalSales.toFixed(2)}`);
        console.log();

        const dinheiroNoSistema = totalUserBalances + totalReserves + totalQuotas;
        const dinheiroQueEntrou = totalDeposits - totalWithdrawals;
        const diferenca = dinheiroNoSistema - dinheiroQueEntrou;

        console.log(`  💵 Dinheiro que entrou (depósitos - saques): R$ ${dinheiroQueEntrou.toFixed(2)}`);
        console.log(`  💼 Dinheiro no sistema (saldos + reservas + cotas): R$ ${dinheiroNoSistema.toFixed(2)}`);
        console.log();

        if (Math.abs(diferenca) < 0.01) {
            console.log(`  ✅ SISTEMA EQUILIBRADO! Diferença: R$ ${diferenca.toFixed(2)}`);
        } else {
            console.log(`  ⚠️  INCONSISTÊNCIA DETECTADA!`);
            console.log(`  🔴 DIFERENÇA: R$ ${diferenca.toFixed(2)}`);
            if (diferenca > 0) {
                console.log(`  → O sistema tem R$ ${diferenca.toFixed(2)} A MAIS do que deveria.`);
                console.log(`  → Possíveis causas: vendas PDV creditando sem débito real, duplicação de saldo.`);
            } else {
                console.log(`  → O sistema tem R$ ${Math.abs(diferenca).toFixed(2)} A MENOS do que deveria.`);
                console.log(`  → Possíveis causas: taxas não registradas, arredondamentos.`);
            }
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('❌ Erro na auditoria:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

audit();
