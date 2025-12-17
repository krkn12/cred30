const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function recreateTablesConsistently() {
  const client = await pool.connect();
  try {
    console.log('Recriando tabelas com estrutura consistente...');
    
    // 1. Recriar tabela loans com estrutura correta
    console.log('\n1. Recriando tabela loans...');
    
    // Verificar se há dados antes de dropar
    const loansDataCheck = await client.query('SELECT COUNT(*) as count FROM loans');
    const hasLoansData = parseInt(loansDataCheck.rows[0].count) > 0;
    
    if (hasLoansData) {
      console.log('ATENÇÃO: Há dados na tabela loans. Fazendo backup...');
      // Fazer backup se necessário (implementar se necessário)
    }
    
    // Dropar e recriar tabela loans
    await client.query('DROP TABLE IF EXISTS loans CASCADE');
    await client.query(`
      CREATE TABLE loans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        total_repayment DECIMAL(10,2) NOT NULL,
        installments INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        due_date TIMESTAMP,
        pix_key_to_receive VARCHAR(255)
      );
    `);
    console.log('Tabela loans recriada com estrutura correta');
    
    // 2. Recriar tabela loan_installments
    console.log('\n2. Recriando tabela loan_installments...');
    
    const installmentsDataCheck = await client.query('SELECT COUNT(*) as count FROM loan_installments');
    const hasInstallmentsData = parseInt(installmentsDataCheck.rows[0].count) > 0;
    
    if (hasInstallmentsData) {
      console.log('ATENÇÃO: Há dados na tabela loan_installments.');
    }
    
    await client.query('DROP TABLE IF EXISTS loan_installments');
    await client.query(`
      CREATE TABLE loan_installments (
        id SERIAL PRIMARY KEY,
        loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        use_balance BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela loan_installments recriada com estrutura correta');
    
    // 3. Verificar e corrigir tabela transactions
    console.log('\n3. Verificando tabela transactions...');
    
    const transactionsDataCheck = await client.query('SELECT COUNT(*) as count FROM transactions');
    const hasTransactionsData = parseInt(transactionsDataCheck.rows[0].count) > 0;
    
    if (hasTransactionsData) {
      console.log('ATENÇÃO: Há dados na tabela transactions. Mantendo estrutura atual para não perder dados.');
      console.log('Dados encontrados:', transactionsDataCheck.rows[0].count);
    } else {
      console.log('Recriando tabela transactions com estrutura consistente...');
      await client.query('DROP TABLE IF EXISTS transactions');
      await client.query(`
        CREATE TABLE transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          type VARCHAR(20) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'PENDING',
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP
        );
      `);
      console.log('Tabela transactions recriada com estrutura consistente');
    }
    
    // 4. Verificar estrutura final de todas as tabelas
    console.log('\n4. Verificando estrutura final...');
    
    const tables = ['users', 'quotas', 'loans', 'loan_installments', 'transactions'];
    
    for (const table of tables) {
      const structure = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${table}'
        AND (column_name = 'id' OR column_name = 'user_id' OR column_name = 'loan_id')
        ORDER BY ordinal_position
      `);
      
      console.log(`\nEstrutura da tabela ${table}:`);
      console.table(structure.rows);
    }
    
    // 5. Verificar foreign keys
    console.log('\n5. Verificando foreign keys...');
    const fkCheck = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('loans', 'quotas', 'transactions', 'loan_installments')
    `);
    
    console.log('Foreign keys verificadas:');
    console.table(fkCheck.rows);
    
    console.log('\nEstrutura do banco corrigida com sucesso!');
    
  } catch (error) {
    console.error('Erro durante a recriação das tabelas:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

recreateTablesConsistently();