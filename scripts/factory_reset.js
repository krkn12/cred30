
const { Pool } = require('pg');
require('dotenv').config({ path: 'packages/backend/.env' });

async function factoryReset() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('🚨 INICIANDO FACTORY RESET (ZERAR DE FÁBRICA) 🚨');

    // 0. Kill other connections to prevent locks
    console.log('🔪 Matando outras conexões para liberar travas...');
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      AND datname = current_database();
    `);

    // await client.query('BEGIN'); // REMOVIDO: Executar sem transação para evitar locks ocultos

    // 1. Truncate ALL tables (Cascade) to clear everything (Users, Transactions, etc.)
    // We get a list of all tables first
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    if (tables.length > 0) {
      // Exclude migration tables if any (not present here usually)
      const tablesToTruncate = tables.map(t => `"${t}"`).join(', ');
      console.log(`🗑️ Limpando ${tables.length} tabelas: ${tablesToTruncate}`);
      await client.query(`TRUNCATE TABLE ${tablesToTruncate} RESTART IDENTITY CASCADE;`);
    }

    // 2. Re-Seed Initial System Config ("Factory Default")
    console.log('🌱 Semeando Configurações de Fábrica...');

    // System Config (Zero Balance)
    await client.query(`
      INSERT INTO system_config (
        system_balance, profit_pool, total_owner_profit, investment_reserve,
        total_tax_reserve, total_operational_reserve, monthly_fixed_costs,
        quota_price, loan_interest_rate, penalty_rate
      ) VALUES (
        0, 0, 0, 0,
        0, 0, 137.00,
        50.00, 0.20, 0.05
      )
    `);

    // System Costs (Defaults)
    await client.query(`
      INSERT INTO system_costs (description, amount, is_recurring, created_at)
      VALUES 
      ('MEI (Mensal)', 87.00, true, NOW()),
      ('Servidor Render', 50.00, true, NOW())
    `);

    // Reward Catalog (Defaults)
    await client.query(`
        INSERT INTO reward_catalog (id, name, type, value, points_cost, is_active, created_at)
        VALUES
        ('gc-ifood-15', 'Cupom iFood R$ 15', 'COUPON', 15.00, 1500, true, NOW()),
        ('gc-uber-20', 'Uber Cash R$ 20', 'GIFT_CARD', 20.00, 2000, true, NOW()),
        ('gc-netflix-25', 'Gift Card Netflix R$ 25', 'GIFT_CARD', 25.00, 2500, true, NOW()),
        ('gc-spotify-1m', 'Spotify Premium 1 mês', 'GIFT_CARD', 20.00, 2000, true, NOW()),
        ('pix-10', 'PIX R$ 10,00', 'PIX', 10.00, 1000, true, NOW()),
        ('pix-50', 'PIX R$ 50,00', 'PIX', 50.00, 5000, true, NOW()),
        ('mentor-1h', 'Mentoria 1h (Luis)', 'MENTORSHIP', 0.00, 10000, true, NOW()),
        ('kit-swag', 'Kit Camiseta + Adesivos', 'PHYSICAL', 0.00, 3000, true, NOW());
    `);


    await client.query('COMMIT');
    console.log('✅ FACTORY RESET CONCLUÍDO!');
    console.log('O sistema está limpo. O primeiro usuário a logar será criado do zero.');

    client.release();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERRO:', err);
  } finally {
    await pool.end();
  }
}

factoryReset();
