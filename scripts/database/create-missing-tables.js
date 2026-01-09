/**
 * Script para criar tabelas que estão faltando no banco
 * Uso: node scripts/database/create-missing-tables.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F6tmdPW5Qqcw@ep-lively-paper-a42z3qg6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function createMissingTables() {
  console.log('🔨 Criando tabelas faltantes...\n');

  const tables = [
    // terms_acceptance - usado para registrar aceite de termos
    {
      name: 'terms_acceptance',
      sql: `
        CREATE TABLE IF NOT EXISTS terms_acceptance (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          terms_version VARCHAR(20) NOT NULL,
          privacy_version VARCHAR(20) NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          accepted_age_requirement BOOLEAN DEFAULT FALSE,
          accepted_risk_disclosure BOOLEAN DEFAULT FALSE,
          accepted_terms BOOLEAN DEFAULT FALSE,
          accepted_privacy BOOLEAN DEFAULT FALSE,
          accepted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, terms_version, privacy_version)
        );
        CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user ON terms_acceptance(user_id);
      `
    },
    // investment_pools - pools de investimento
    {
      name: 'investment_pools',
      sql: `
        CREATE TABLE IF NOT EXISTS investment_pools (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          target_amount DECIMAL(15,2) DEFAULT 0,
          current_amount DECIMAL(15,2) DEFAULT 0,
          min_investment DECIMAL(15,2) DEFAULT 10,
          max_investment DECIMAL(15,2) DEFAULT 1000,
          interest_rate DECIMAL(5,4) DEFAULT 0.02,
          duration_days INTEGER DEFAULT 30,
          status VARCHAR(20) DEFAULT 'PENDING',
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_investment_pools_status ON investment_pools(status);
      `
    },
    // earnings - ganhos dos usuários
    {
      name: 'earnings',
      sql: `
        CREATE TABLE IF NOT EXISTS earnings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          source VARCHAR(50) NOT NULL,
          source_id VARCHAR(100),
          amount DECIMAL(15,2) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'PENDING',
          withdrawn BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id);
        CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings(status);
        CREATE INDEX IF NOT EXISTS idx_earnings_withdrawn ON earnings(withdrawn);
      `
    },
    // withdrawals - saques
    {
      name: 'withdrawals',
      sql: `
        CREATE TABLE IF NOT EXISTS withdrawals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          pix_key VARCHAR(200),
          pix_type VARCHAR(20),
          status VARCHAR(20) DEFAULT 'PENDING',
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      `
    },
    // deposits - depósitos
    {
      name: 'deposits',
      sql: `
        CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          source VARCHAR(50) DEFAULT 'MANUAL',
          source_id VARCHAR(100),
          status VARCHAR(20) DEFAULT 'PENDING',
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
        CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
      `
    },
    // credit_applications - aplicações de crédito
    {
      name: 'credit_applications',
      sql: `
        CREATE TABLE IF NOT EXISTS credit_applications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          requested_amount DECIMAL(15,2) NOT NULL,
          approved_amount DECIMAL(15,2),
          purpose VARCHAR(100),
          status VARCHAR(20) DEFAULT 'PENDING',
          reviewed_by INTEGER,
          reviewed_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_credit_applications_user ON credit_applications(user_id);
        CREATE INDEX IF NOT EXISTS idx_credit_applications_status ON credit_applications(status);
      `
    },
    // jobs - trabalhos/vagas
    {
      name: 'jobs',
      sql: `
        CREATE TABLE IF NOT EXISTS jobs (
          id SERIAL PRIMARY KEY,
          title VARCHAR(100) NOT NULL,
          description TEXT,
          location VARCHAR(100),
          salary VARCHAR(50),
          type VARCHAR(50) DEFAULT 'PART_TIME',
          status VARCHAR(20) DEFAULT 'ACTIVE',
          posted_by INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      `
    },
    // job_applications - candidaturas
    {
      name: 'job_applications',
      sql: `
        CREATE TABLE IF NOT EXISTS job_applications (
          id SERIAL PRIMARY KEY,
          job_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          message TEXT,
          status VARCHAR(20) DEFAULT 'PENDING',
          reviewed_by INTEGER,
          reviewed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(job_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
        CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_id);
      `
    }
  ];

  for (const table of tables) {
    try {
      await pool.query(table.sql);
      console.log(`   ✅ ${table.name}`);
    } catch (err) {
      console.log(`   ❌ ${table.name}: ${err.message}`);
    }
  }

  // Verificar todas as tabelas
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 VERIFICAÇÃO FINAL:\n');
  
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log(`Total de tabelas: ${result.rows.length}`);
  result.rows.forEach(r => console.log(`   - ${r.table_name}`));

  console.log('\n✅ Tabelas faltantes criadas!\n');

  await pool.end();
}

createMissingTables().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
