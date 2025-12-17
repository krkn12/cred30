const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30'
});

async function populateTestData() {
  console.log('🌱 Populando dados de teste...');

  try {
    // Limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM withdrawals');
    await pool.query('DELETE FROM loan_installments');
    await pool.query('DELETE FROM loans');
    await pool.query('DELETE FROM quotas');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM app_settings');

    // Inserir configurações do sistema
    console.log('⚙️ Inserindo configurações do sistema...');
    await pool.query(`
      INSERT INTO app_settings (key, value, description) VALUES
      ('quota_price', '50', 'Preço unitário das cotas de investimento'),
      ('loan_interest_rate', '0.2', 'Taxa de juros dos empréstimos (20%)'),
      ('penalty_rate', '0.4', 'Taxa de multa por atraso (40%)'),
      ('admin_pix_key', 'admin@pix.local', 'Chave PIX do administrador'),
      ('min_loan_amount', '100', 'Valor mínimo de empréstimo'),
      ('max_loan_amount', '10000', 'Valor máximo de empréstimo')
    `);

    // Criar usuários
    console.log('👥 Criando usuários...');
    
    // Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, balance, total_invested)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Administrador', 'admin@cred30.com', adminPassword, 'admin', 0, 0]);
    const adminId = adminResult.rows[0].id;

    // Cliente 1
    const client1Password = await bcrypt.hash('cliente123', 10);
    const client1Result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, balance, total_invested)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['João Silva', 'joao@cred30.com', client1Password, 'client', 1500, 1000]);
    const client1Id = client1Result.rows[0].id;

    // Cliente 2
    const client2Password = await bcrypt.hash('cliente123', 10);
    const client2Result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, balance, total_invested)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Maria Santos', 'maria@cred30.com', client2Password, 'client', 800, 500]);
    const client2Id = client2Result.rows[0].id;

    // Cliente 3
    const client3Password = await bcrypt.hash('cliente123', 10);
    const client3Result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, balance, total_invested)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['Pedro Costa', 'pedro@cred30.com', client3Password, 'client', 200, 200]);
    const client3Id = client3Result.rows[0].id;

    // Inserir cotas para clientes
    console.log('📊 Inserindo cotas...');
    
    // Cotas do Cliente 1
    await pool.query(`
      INSERT INTO quotas (user_id, quantity, unit_price, total_amount, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [client1Id, 20, 50, 1000, 'active']);

    // Cotas do Cliente 2
    await pool.query(`
      INSERT INTO quotas (user_id, quantity, unit_price, total_amount, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [client2Id, 10, 50, 500, 'active']);

    // Cotas do Cliente 3
    await pool.query(`
      INSERT INTO quotas (user_id, quantity, unit_price, total_amount, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [client3Id, 4, 50, 200, 'active']);

    // Inserir empréstimos
    console.log('💰 Inserindo empréstimos...');
    
    // Empréstimo aprovado Cliente 1
    const loan1Result = await pool.query(`
      INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, term_days, status, approved_at, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [client1Id, 500, 0.2, 0.4, 30, 'approved', new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]);
    const loan1Id = loan1Result.rows[0].id;

    // Empréstimo pendente Cliente 2
    const loan2Result = await pool.query(`
      INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, term_days, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [client2Id, 300, 0.2, 0.4, 30, 'pending']);
    const loan2Id = loan2Result.rows[0].id;

    // Empréstimo aprovado Cliente 3
    const loan3Result = await pool.query(`
      INSERT INTO loans (user_id, amount, interest_rate, penalty_rate, term_days, status, approved_at, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [client3Id, 200, 0.2, 0.4, 30, 'approved', new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]);
    const loan3Id = loan3Result.rows[0].id;

    // Inserir parcelas para empréstimos
    console.log('📋 Inserindo parcelas dos empréstimos...');
    
    // Parcelas do Empréstimo 1 (aprovado)
    for (let i = 1; i <= 3; i++) {
      await pool.query(`
        INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [loan1Id, i, 500/3, new Date(Date.now() + i * 10 * 24 * 60 * 60 * 1000), i === 1 ? 'paid' : 'pending']);
    }

    // Parcelas do Empréstimo 3 (aprovado)
    for (let i = 1; i <= 2; i++) {
      await pool.query(`
        INSERT INTO loan_installments (loan_id, installment_number, amount, due_date, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [loan3Id, i, 200/2, new Date(Date.now() + i * 15 * 24 * 60 * 60 * 1000), i === 1 ? 'paid' : 'pending']);
    }

    // Inserir transações
    console.log('📝 Inserindo transações...');
    
    // Transações do Cliente 1
    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [client1Id, 'investment', 1000, 'Compra de 20 cotas']);

    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [client1Id, 'loan_disbursement', 500, 'Liberação de empréstimo']);

    // Transações do Cliente 2
    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [client2Id, 'investment', 500, 'Compra de 10 cotas']);

    // Transações do Cliente 3
    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [client3Id, 'investment', 200, 'Compra de 4 cotas']);

    await pool.query(`
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES ($1, $2, $3, $4)
    `, [client3Id, 'loan_disbursement', 200, 'Liberação de empréstimo']);

    // Inserir saques
    console.log('💸 Inserindo saques...');
    
    // Saque pendente Cliente 1
    await pool.query(`
      INSERT INTO withdrawals (user_id, amount, pix_key, status)
      VALUES ($1, $2, $3, $4)
    `, [client1Id, 200, 'joao@pix.com', 'pending']);

    // Saque processado Cliente 2
    await pool.query(`
      INSERT INTO withdrawals (user_id, amount, pix_key, status, processed_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [client2Id, 100, 'maria@pix.com', 'processed', new Date()]);

    console.log('✅ Dados de teste populados com sucesso!');
    console.log('');
    console.log('👥 Usuários criados:');
    console.log('   Admin: admin@cred30.com / admin123');
    console.log('   Cliente 1: joao@cred30.com / cliente123 (Saldo: R$ 1.500, Investido: R$ 1.000)');
    console.log('   Cliente 2: maria@cred30.com / cliente123 (Saldo: R$ 800, Investido: R$ 500)');
    console.log('   Cliente 3: pedro@cred30.com / cliente123 (Saldo: R$ 200, Investido: R$ 200)');
    console.log('');
    console.log('📊 Resumo dos dados:');
    console.log('   - 4 usuários (1 admin, 3 clientes)');
    console.log('   - 34 cotas vendidas (R$ 1.700 total)');
    console.log('   - 3 empréstimos (2 aprovados, 1 pendente)');
    console.log('   - 5 parcelas de empréstimos');
    console.log('   - 6 transações');
    console.log('   - 2 saques (1 pendente, 1 processado)');

  } catch (error) {
    console.error('❌ Erro ao popular dados de teste:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  populateTestData();
}

module.exports = { populateTestData };