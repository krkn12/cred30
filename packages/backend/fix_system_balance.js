require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixSystemBalance() {
    try {
        // 1. Calcular o valor real que deveria estar no sistema

        // Total de cotas ativas (dinheiro que entrou)
        const quotas = await pool.query(`
      SELECT COALESCE(SUM(current_value), 0) as total FROM quotas WHERE status = 'ACTIVE'
    `);
        const quotasValue = parseFloat(quotas.rows[0].total);

        // Total de empréstimos ativos (dinheiro que saiu)
        const loans = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status IN ('APPROVED', 'PAYMENT_PENDING')
    `);
        const loansValue = parseFloat(loans.rows[0].total);

        // Total de saques aprovados (dinheiro que saiu ou vai sair)
        const withdrawals = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
      WHERE type = 'WITHDRAWAL' AND status = 'APPROVED'
    `);
        const withdrawalsValue = parseFloat(withdrawals.rows[0].total);

        // Total de taxas de manutenção recebidas (R$ 8 por cota)
        const adminFees = await pool.query(`
      SELECT COUNT(*) as count FROM quotas
    `);
        const totalAdminFees = parseInt(adminFees.rows[0].count) * 8; // R$ 8 por cota

        // Verificar config atual
        const config = await pool.query('SELECT * FROM system_config LIMIT 1');
        const currentBalance = parseFloat(config.rows[0].system_balance);
        const profitPool = parseFloat(config.rows[0].profit_pool);

        // O saldo correto deveria ser:
        // (Cotas Ativas valorResgatável) + (Taxas Adm) - (Empréstimos) - (Saques)
        const correctBalance = quotasValue + totalAdminFees - loansValue - withdrawalsValue;

        console.log('=== DIAGNÓSTICO ===');
        console.log('Cotas ativas (valor resgatável):', quotasValue);
        console.log('Taxas administrativas (R$ 8 x cotas):', totalAdminFees);
        console.log('Empréstimos ativos:', loansValue);
        console.log('Saques aprovados:', withdrawalsValue);
        console.log('\nSaldo atual:', currentBalance);
        console.log('Saldo correto calculado:', correctBalance);
        console.log('Diferença (inflação):', currentBalance - correctBalance);

        // CORREÇÃO
        console.log('\n=== APLICANDO CORREÇÃO ===');

        // Definir o system_balance para o valor correto
        // Manter o profit_pool como está
        await pool.query(
            'UPDATE system_config SET system_balance = $1',
            [correctBalance]
        );

        // Verificar após correção
        const afterConfig = await pool.query('SELECT system_balance, profit_pool FROM system_config LIMIT 1');
        console.log('Novo System Balance:', afterConfig.rows[0].system_balance);
        console.log('Profit Pool mantido:', afterConfig.rows[0].profit_pool);

        console.log('\n✅ Sistema corrigido com sucesso!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

// ATENÇÃO: Este script irá modificar o banco de dados!
// Descomente a linha abaixo para executar a correção
fixSystemBalance();
