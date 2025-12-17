const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30',
});

async function seedData() {
  console.log('🌱 Inserindo dados iniciais...');
  
  try {
    // Verificar se já existe um admin
    const adminCheck = await pool.query('SELECT id FROM users WHERE is_admin = true LIMIT 1');
    
    if (adminCheck.rows.length === 0) {
      // Criar usuário admin
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const adminResult = await pool.query(`
        INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, email, referral_code
      `, [
        'Administrador',
        'admin@cred30.local',
        hashedPassword,
        'admin',
        'admin@pix.local',
        10000, // Saldo inicial para testes
        'ADMIN001',
        true
      ]);
      
      console.log('👤 Usuário admin criado:', adminResult.rows[0]);
    }
    
    // Criar usuários de teste
    const testUsers = [
      {
        name: 'Usuário Teste 1',
        email: 'teste1@cred30.local',
        password: 'teste123',
        secretPhrase: 'teste123',
        pixKey: 'teste1@pix.local',
        balance: 1000,
        referralCode: 'TESTE001'
      },
      {
        name: 'Usuário Teste 2',
        email: 'teste2@cred30.local',
        password: 'teste123',
        secretPhrase: 'teste123',
        pixKey: 'teste2@pix.local',
        balance: 500,
        referralCode: 'TESTE002'
      },
      {
        name: 'Usuário Teste 3',
        email: 'teste3@cred30.local',
        password: 'teste123',
        secretPhrase: 'teste123',
        pixKey: 'teste3@pix.local',
        balance: 2000,
        referralCode: 'TESTE003'
      }
    ];
    
    for (const user of testUsers) {
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
      
      if (existingUser.rows.length === 0) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        const result = await pool.query(`
          INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, name, email, referral_code
        `, [
          user.name,
          user.email,
          hashedPassword,
          user.secretPhrase,
          user.pixKey,
          user.balance,
          user.referralCode,
          false
        ]);
        
        console.log('👤 Usuário teste criado:', result.rows[0]);
        
        // Criar algumas cotas para o usuário teste 1
        if (user.email === 'teste1@cred30.local') {
          const userId = result.rows[0].id;
          
          for (let i = 0; i < 3; i++) {
            await pool.query(`
              INSERT INTO quotas (user_id, purchase_price, current_value, purchase_date, status)
              VALUES ($1, 50, 50, NOW() - INTERVAL '${i + 1} days', 'ACTIVE')
            `, [userId]);
          }
          
          console.log('💰 3 cotas criadas para usuário teste1');
        }
      }
    }
    
    // Criar empréstimos de teste
    const testLoans = [
      {
        userId: 2, // Usuário Teste 1
        amount: 200,
        totalRepayment: 240,
        installments: 2,
        interestRate: 0.2,
        status: 'APPROVED',
        pixKeyToReceive: 'teste1@pix.local'
      },
      {
        userId: 3, // Usuário Teste 2
        amount: 100,
        totalRepayment: 120,
        installments: 1,
        interestRate: 0.2,
        status: 'PENDING',
        pixKeyToReceive: 'teste2@pix.local'
      }
    ];
    
    for (const loan of testLoans) {
      const existingLoan = await pool.query('SELECT id FROM loans WHERE user_id = $1 AND status = $2', [loan.userId, loan.status]);
      
      if (existingLoan.rows.length === 0) {
        const result = await pool.query(`
          INSERT INTO loans (user_id, amount, total_repayment, installments, interest_rate, status, due_date, pix_key_to_receive)
          VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '30 days', $7)
          RETURNING id, amount, status
        `, [
          loan.userId,
          loan.amount,
          loan.totalRepayment,
          loan.installments,
          loan.interestRate,
          loan.status,
          loan.pixKeyToReceive
        ]);
        
        console.log('💳 Empréstimo teste criado:', result.rows[0]);
      }
    }
    
    // Criar transações de teste
    const testTransactions = [
      {
        userId: 2,
        type: 'BUY_QUOTA',
        amount: 150,
        description: 'Compra de 3 cotas',
        status: 'APPROVED'
      },
      {
        userId: 3,
        type: 'DEPOSIT',
        amount: 50,
        description: 'Bônus de boas-vindas',
        status: 'APPROVED'
      }
    ];
    
    for (const transaction of testTransactions) {
      const existingTransaction = await pool.query('SELECT id FROM transactions WHERE user_id = $1 AND type = $2', [transaction.userId, transaction.type]);
      
      if (existingTransaction.rows.length === 0) {
        const result = await pool.query(`
          INSERT INTO transactions (user_id, type, amount, description, status, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, type, amount, status
        `, [
          transaction.userId,
          transaction.type,
          transaction.amount,
          transaction.description,
          transaction.status,
          JSON.stringify({ test: true })
        ]);
        
        console.log('📄 Transação teste criada:', result.rows[0]);
      }
    }
    
    console.log('✅ Dados iniciais inseridos com sucesso!');
    console.log('');
    console.log('🔐 Credenciais de Acesso:');
    console.log('   Admin: admin@cred30.local / admin123 / admin');
    console.log('   Teste 1: teste1@cred30.local / teste123 / teste123');
    console.log('   Teste 2: teste2@cred30.local / teste123 / teste123');
    console.log('   Teste 3: teste3@cred30.local / teste123 / teste123');
    console.log('');
    console.log('💰 Saldos Iniciais:');
    console.log('   Admin: R$ 10.000,00');
    console.log('   Teste 1: R$ 1.000,00 (3 cotas)');
    console.log('   Teste 2: R$ 500,00 (empréstimo pendente)');
    console.log('   Teste 3: R$ 2.000,00');
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados iniciais:', error);
  } finally {
    await pool.end();
  }
}

seedData();