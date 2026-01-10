const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function resetAdminAndSystem() {
    try {
        console.log("🚀 Iniciando reset para 'Começar do Zero'...");

        // 1. Zerar saldo e pontos do Admin (ID 11)
        await pool.query(`
      UPDATE users 
      SET balance = 0, 
          score = 1000, 
          ad_points = 0, 
          video_points = 0,
          total_dividends_earned = 0
      WHERE role = 'ADMIN'
    `);
        console.log("✅ Saldo e estatísticas do Admin zerados.");

        // 2. Zerar Configurações do Sistema
        await pool.query(`
      UPDATE system_config 
      SET system_balance = 0, 
          profit_pool = 0, 
          total_gateway_costs = 0, 
          total_manual_costs = 0, 
          total_tax_reserve = 0, 
          total_operational_reserve = 0, 
          total_owner_profit = 0, 
          investment_reserve = 0
    `);
        console.log("✅ Caixa e reservas do sistema zerados.");

        // 3. Limpar dados transacionais (Opcional, mas recomendado para 'começar do zero')
        // Comentado por segurança, remova o comentário se quiser limpar TUDO (cotas, empréstimos, transações)
        /*
        await pool.query('TRUNCATE TABLE transactions CASCADE');
        await pool.query('TRUNCATE TABLE quotas CASCADE');
        await pool.query('TRUNCATE TABLE loans CASCADE');
        await pool.query('TRUNCATE TABLE loan_installments CASCADE');
        await pool.query('TRUNCATE TABLE admin_logs CASCADE');
        console.log("✅ Histórico de transações, cotas e empréstimos limpo.");
        */

        console.log("\n✨ Pronto Josias! Admin zerado e pronto para o reinício.");
    } catch (err) {
        console.error("❌ Erro durante o reset:", err);
    } finally {
        await pool.end();
    }
}

resetAdminAndSystem();
