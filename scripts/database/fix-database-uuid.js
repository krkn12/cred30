/**
 * Script para corrigir o banco de dados com UUID
 * Remove todas as tabelas e recria com o schema correto
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuração do PostgreSQL
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'postgres', // Conectar ao postgres primeiro
};

async function fixDatabase() {
  const pool = new Pool(poolConfig);
  const client = await pool.connect();
  
  try {
    console.log('🔧 Conectado ao PostgreSQL para correção do schema...');
    
    // 1. Dropar o banco de dados se existir
    await client.query(`DROP DATABASE IF EXISTS ${process.env.DB_DATABASE || 'cred30'} WITH (FORCE);`);
    console.log('✅ Banco de dados antigo removido');
    
    // 2. Criar banco de dados novo
    await client.query(`CREATE DATABASE ${process.env.DB_DATABASE || 'cred30'};`);
    console.log('✅ Banco de dados novo criado');
    
    // 3. Conectar ao novo banco de dados
    await client.end();
    
    const newPoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'cred30user',
      password: process.env.DB_PASSWORD || 'cred30pass',
      database: process.env.DB_DATABASE || 'cred30',
    };
    
    const newPool = new Pool(newPoolConfig);
    const newClient = await newPool.connect();
    
    console.log('🔧 Conectado ao novo banco de dados...');
    
    // 4. Criar extensão UUID
    await newClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✅ Extensão UUID criada');
    
    // 5. Criar todas as tabelas com UUID
    const createTablesSQL = `
      -- Tabela de usuários
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        secret_phrase VARCHAR(255) NOT NULL,
        pix_key VARCHAR(255) NOT NULL,
        balance DECIMAL(10,2) DEFAULT 0,
        referral_code VARCHAR(10) UNIQUE,
        referred_by VARCHAR(10),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Tabela de cotas
      CREATE TABLE quotas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        purchase_price DECIMAL(10,2) NOT NULL,
        current_value DECIMAL(10,2) NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'ACTIVE'
      );
      
      -- Tabela de empréstimos
      CREATE TABLE loans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
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
      
      -- Tabela de parcelas de empréstimos
      CREATE TABLE loan_installments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        use_balance BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Tabela de transações
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'PENDING',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
      
      -- Tabela de configuração do sistema
      CREATE TABLE system_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        system_balance DECIMAL(15,2) DEFAULT 0,
        profit_pool DECIMAL(15,2) DEFAULT 0,
        quota_price DECIMAL(10,2) DEFAULT 100,
        loan_interest_rate DECIMAL(5,2) DEFAULT 0.2,
        penalty_rate DECIMAL(5,2) DEFAULT 0.4,
        vesting_period_ms BIGINT DEFAULT 31536000000,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Inserir configuração inicial do sistema
      INSERT INTO system_config (system_balance, profit_pool, quota_price, loan_interest_rate, penalty_rate)
      VALUES (0, 0, 100, 0.2, 0.4);
    `;
    
    await newClient.query(createTablesSQL);
    console.log('✅ Todas as tabelas criadas com UUID');
    
    // 6. Criar índices
    const createIndexesSQL = `
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_quotas_user_id ON quotas(user_id);
      CREATE INDEX idx_loans_user_id ON loans(user_id);
      CREATE INDEX idx_loans_status ON loans(status);
      CREATE INDEX idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX idx_transactions_type ON transactions(type);
      CREATE INDEX idx_loan_installments_loan_id ON loan_installments(loan_id);
    `;
    
    await newClient.query(createIndexesSQL);
    console.log('✅ Índices criados');
    
    // 7. Verificar schema
    const tables = await newClient.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log('\n📋 Schema do banco de dados:');
    console.table(tables.rows);
    
    await newClient.end();
    await newPool.end();
    
    console.log('\n🎉 Banco de dados corrigido com sucesso!');
    console.log('📝 Todas as tabelas agora usam UUID como primary key');
    console.log('🔗 Chaves estrangeiras funcionarão corretamente');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir banco de dados:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar correção
fixDatabase();