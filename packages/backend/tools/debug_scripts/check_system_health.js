require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkSystemHealth() {
    try {
        // 1. Verificar system_config
        const config = await pool.query('SELECT * FROM system_config LIMIT 1');
        console.log('=== SYSTEM_CONFIG ===');
        console.log('System Balance:', config.rows[0].system_balance);
        console.log('Profit Pool:', config.rows[0].profit_pool);
        console.log('Tax Reserve:', config.rows[0].total_tax_reserve);
        console.log('Operational Reserve:', config.rows[0].total_operational_reserve);
        console.log('Owner Profit:', config.rows[0].total_owner_profit);

        // 2. Verificar cotas ativas (valor real no sistema)
        const quotas = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(current_value), 0) as total_value
      FROM quotas WHERE status = 'ACTIVE'
    `);
        console.log('\n=== COTAS ATIVAS ===');
        console.log('Quantidade:', quotas.rows[0].count);
        console.log('Valor Total:', quotas.rows[0].total_value);

        // 3. Verificar saldos de usuários (passivo - devemos aos usuários)
        const userBalances = await pool.query(`
      SELECT COALESCE(SUM(balance), 0) as total FROM users
    `);
        console.log('\n=== SALDOS USUÁRIOS (PASSIVO) ===');
        console.log('Total que devemos aos usuários:', userBalances.rows[0].total);

        // 4. Verificar empréstimos ativos (dinheiro emprestado)
        const loans = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')
    `);
        console.log('\n=== EMPRÉSTIMOS ATIVOS ===');
        console.log('Total emprestado:', loans.rows[0].total);

        // 5. Calcular se faz sentido
        const systemBalance = parseFloat(config.rows[0].system_balance);
        const profitPool = parseFloat(config.rows[0].profit_pool);
        const quotasValue = parseFloat(quotas.rows[0].total_value);
        const userBalance = parseFloat(userBalances.rows[0].total);
        const loansTotal = parseFloat(loans.rows[0].total);

        // Caixa bruto = Cotas compradas - Empréstimos ativos
        const expectedCash = quotasValue - loansTotal;

        console.log('\n=== VALIDAÇÃO ===');
        console.log('Caixa esperado (Cotas - Empréstimos):', expectedCash.toFixed(2));
        console.log('System Balance atual:', systemBalance.toFixed(2));
        console.log('Diferença:', (systemBalance - expectedCash).toFixed(2));

        if (systemBalance > expectedCash + 100) {
            console.log('\n⚠️  ALERTA: System Balance parece inflado!');
        } else {
            console.log('\n✅ System Balance parece correto.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSystemHealth();
