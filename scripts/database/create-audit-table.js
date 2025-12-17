const { Pool } = require('pg');

// Configuração do banco de dados
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cred30user',
  password: process.env.DB_PASSWORD || 'cred30pass',
  database: process.env.DB_DATABASE || 'cred30',
});

async function createAuditTable() {
  try {
    console.log('Criando tabela de auditoria...');
    
    // Criar tabela de auditoria se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        entity_id INTEGER,
        entity_type VARCHAR(50),
        details TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Criar índices para performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);
    
    console.log('Tabela de auditoria criada com sucesso!');
    
  } catch (error) {
    console.error('Erro ao criar tabela de auditoria:', error);
  } finally {
    await pool.end();
  }
}

// Executar criação da tabela
createAuditTable();