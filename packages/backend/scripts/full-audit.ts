import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fullDatabaseAudit() {
    console.log('='.repeat(80));
    console.log('📊 AUDITORIA COMPLETA DO BANCO DE DADOS CRED30');
    console.log('='.repeat(80));
    console.log(`\n🕐 Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
        // 1. Users
        console.log('\n👥 USUÁRIOS');
        console.log('-'.repeat(40));
        const users = await pool.query(`SELECT * FROM users ORDER BY id`);
        console.log(`Total: ${users.rows.length}`);
        users.rows.forEach(u => {
            console.log(`  [${u.id}] ${u.name} | Email: ${u.email} | Saldo: R$${Number(u.balance || 0).toFixed(2)} | Score: ${u.score || 0} | Admin: ${u.is_admin}`);
        });

        // 2. Quotas
        console.log('\n💰 COTAS (QUOTAS)');
        console.log('-'.repeat(40));
        try {
            const quotas = await pool.query(`SELECT * FROM quotas LIMIT 20`);
            console.log(`Total (máx 20): ${quotas.rows.length}`);
            quotas.rows.forEach(q => {
                console.log(`  [${q.id}] Valor: R$${Number(q.value || 0).toFixed(2)} | Status: ${q.status} | User: ${q.user_id}`);
            });
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler quotas: ${e.message}`); }

        // 3. Transactions
        console.log('\n📝 TRANSAÇÕES (últimas 30)');
        console.log('-'.repeat(40));
        try {
            const transactions = await pool.query(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 30`);
            console.log(`Exibindo: ${transactions.rows.length}`);
            transactions.rows.forEach(t => {
                const amount = Number(t.amount || 0);
                const sign = amount >= 0 ? '+' : '';
                console.log(`  [${t.type}] User ${t.user_id} | ${sign}R$${amount.toFixed(2)} | ${t.status} | ${(t.description || '').substring(0, 40)}`);
            });
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler transactions: ${e.message}`); }

        // 4. Loans
        console.log('\n🏦 EMPRÉSTIMOS');
        console.log('-'.repeat(40));
        try {
            const loans = await pool.query(`SELECT * FROM loans ORDER BY created_at DESC LIMIT 10`);
            console.log(`Total (máx 10): ${loans.rows.length}`);
            loans.rows.forEach(l => {
                console.log(`  [${l.id}] User ${l.user_id} | R$${Number(l.amount || 0).toFixed(2)} | Status: ${l.status}`);
            });
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler loans: ${e.message}`); }

        // 5. Consortium Groups
        console.log('\n🤝 GRUPOS DE CONSÓRCIO');
        console.log('-'.repeat(40));
        try {
            const consortiumGroups = await pool.query(`SELECT * FROM consortium_groups ORDER BY created_at DESC`);
            console.log(`Total: ${consortiumGroups.rows.length}`);
            consortiumGroups.rows.forEach(g => {
                console.log(`  [${g.id}] ${g.name} | Valor: R$${Number(g.total_value || 0).toFixed(2)} | Parcela: R$${Number(g.monthly_installment_value || 0).toFixed(2)} | Status: ${g.status}`);
            });
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler consortium_groups: ${e.message}`); }

        // 6. Consortium Members
        console.log('\n👤 MEMBROS DE CONSÓRCIO');
        console.log('-'.repeat(40));
        try {
            const consortiumMembers = await pool.query(`SELECT * FROM consortium_members ORDER BY created_at DESC`);
            console.log(`Total: ${consortiumMembers.rows.length}`);
            consortiumMembers.rows.forEach(m => {
                console.log(`  Cota #${m.quota_number} | User ${m.user_id} | Group ${m.group_id} | Status: ${m.status}`);
            });
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler consortium_members: ${e.message}`); }

        // 7. System Config
        console.log('\n⚙️ SYSTEM CONFIG');
        console.log('-'.repeat(40));
        try {
            const systemConfig = await pool.query(`SELECT * FROM system_config WHERE id = 1`);
            if (systemConfig.rows[0]) {
                const sc = systemConfig.rows[0];
                console.log(`  Fundo Mútuo: R$${Number(sc.mutual_fund_balance || 0).toFixed(2)}`);
                console.log(`  Reserva Investimentos: R$${Number(sc.investment_reserve_balance || 0).toFixed(2)}`);
                console.log(`  Total em Cotas: R$${Number(sc.total_quotas_value || 0).toFixed(2)}`);
            }
        } catch (e: any) { console.log(`  ⚠️ Erro ao ler system_config: ${e.message}`); }

        // Summary
        console.log('\n📈 RESUMO GERAL');
        console.log('='.repeat(80));
        const totalUsersBalance = users.rows.reduce((sum, u) => sum + Number(u.balance || 0), 0);
        console.log(`  Soma Saldos Usuários: R$${totalUsersBalance.toFixed(2)}`);
        console.log(`  Qtd Usuários: ${users.rows.length}`);

        console.log('\n✅ Auditoria concluída!');

    } catch (error: any) {
        console.error('Erro geral:', error.message);
    }

    await pool.end();
}

fullDatabaseAudit().catch(console.error);
