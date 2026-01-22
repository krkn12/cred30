const { Pool } = require('pg');
const fs = require('fs');

const DATABASE_URL = "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function fullSnapshot() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const snapshot = {
        timestamp: new Date().toISOString(),
        tables: {}
    };

    const tablesToDump = [
        'users',
        'quotas',
        'loans',
        'transactions',
        'system_config',
        'marketplace_listings',
        'marketplace_orders',
        'system_costs',
        'admin_logs'
    ];

    try {
        console.log('--- INICIANDO SNAPSHOT 100% (NEON) ---');

        for (const table of tablesToDump) {
            console.log(`Extraindo: ${table}...`);
            try {
                const res = await pool.query(`SELECT * FROM ${table}`);
                snapshot.tables[table] = {
                    count: res.rows.length,
                    rows: res.rows
                };
            } catch (e) {
                console.error(`Erro ao extrair ${table}:`, e.message);
                snapshot.tables[table] = { error: e.message };
            }
        }

        const fileName = 'prod_full_snapshot.json';
        fs.writeFileSync(fileName, JSON.stringify(snapshot, null, 2));
        console.log(`Snapshot salvo em ${fileName}`);

        // Gerar resumo legível
        let summary = `--- RESUMO EXECUTIVO (100% REAL) ---\n`;
        summary += `Data: ${new Date().toLocaleString('pt-BR')}\n\n`;

        summary += `👥 USUÁRIOS: ${snapshot.tables.users.count}\n`;
        summary += `📈 COTAS ATIVAS: ${snapshot.tables.quotas.count}\n`;
        summary += `💸 EMPRÉSTIMOS: ${snapshot.tables.loans.count}\n`;
        summary += `🔄 TRANSAÇÕES TOTAIS: ${snapshot.tables.transactions.count}\n\n`;

        const config = snapshot.tables.system_config.rows[0];
        summary += `💰 SAÚDE FINANCEIRA:\n`;
        summary += `- Saldo Operacional: R$ ${config.system_balance}\n`;
        summary += `- Pool de Lucros: R$ ${config.profit_pool}\n`;
        summary += `- Reserva de Investimento: R$ ${config.investment_reserve}\n`;
        summary += `- Lucro Admin Acumulado: R$ ${config.total_owner_profit}\n`;
        summary += `- Reserva Fiscal: R$ ${config.total_tax_reserve}\n`;

        fs.writeFileSync('prod_summary_report.txt', summary);
        console.log('Resumo salvo em prod_summary_report.txt');

    } catch (err) {
        console.error('ERRO FATAL NO SNAPSHOT:', err);
    } finally {
        await pool.end();
    }
}

fullSnapshot();
