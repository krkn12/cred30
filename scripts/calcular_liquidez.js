const { Client } = require('pg');

const url = 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new Client({ connectionString: url });

async function calcularLiquidez() {
    try {
        await client.connect();

        // Buscar dados necessários
        const quotasRes = await client.query("SELECT COUNT(*) FROM quotas WHERE status = 'ACTIVE'");
        const loansRes = await client.query("SELECT SUM(amount) FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')");
        const usersRes = await client.query('SELECT SUM(balance) FROM users');

        const cotasAtivas = parseInt(quotasRes.rows[0].count);
        const emprestimos = parseFloat(loansRes.rows[0].sum || 0);
        const saldosUsuarios = parseFloat(usersRes.rows[0].sum || 0);

        // Calcular liquidez (Fórmula do Josias)
        const capitalSocial = cotasAtivas * 42; // R$ 42 por cota
        const liquidezReal = capitalSocial + saldosUsuarios - emprestimos;

        console.log('\n========================================');
        console.log('📊 CÁLCULO DA LIQUIDEZ REAL');
        console.log('========================================');
        console.log('Cotas Ativas:', cotasAtivas);
        console.log('Capital Social (cotas × R$ 42):', 'R$', capitalSocial.toFixed(2));
        console.log('Saldos de Usuários:', 'R$', saldosUsuarios.toFixed(2));
        console.log('Empréstimos Sacados:', 'R$', emprestimos.toFixed(2));
        console.log('----------------------------------------');
        console.log('💰 LIQUIDEZ REAL:', 'R$', liquidezReal.toFixed(2));
        console.log('========================================\n');

        if (liquidezReal === 14) {
            console.log('✅ CORRETO! Liquidez = +R$ 14,00\n');
        } else {
            console.log('❌ ERRO! Esperado: +R$ 14,00, Atual: R$', liquidezReal.toFixed(2), '\n');
        }

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await client.end();
    }
}

calcularLiquidez();
