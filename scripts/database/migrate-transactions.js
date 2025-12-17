const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function migrateTransactions() {
  const client = await pool.connect();
  try {
    console.log('Migrando dados da tabela transactions...');
    
    // 1. Backup dos dados existentes
    const existingData = await client.query('SELECT * FROM transactions');
    console.log(`Encontradas ${existingData.rows.length} transações para migrar`);
    
    if (existingData.rows.length > 0) {
      console.log('Dados a serem migrados:');
      console.table(existingData.rows);
    }
    
    // 2. Criar tabela temporária com os dados
    if (existingData.rows.length > 0) {
      await client.query('CREATE TEMP TABLE transactions_backup AS SELECT * FROM transactions');
      console.log('Backup temporário criado');
    }
    
    // 3. Dropar tabela original
    await client.query('DROP TABLE transactions');
    console.log('Tabela original removida');
    
    // 4. Recriar tabela com estrutura consistente
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
    console.log('Tabela recriada com estrutura consistente');
    
    // 5. Restaurar dados se houver
    if (existingData.rows.length > 0) {
      for (const row of existingData.rows) {
        await client.query(`
          INSERT INTO transactions (user_id, type, amount, description, status, metadata, created_at, processed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          row.user_id,
          row.type,
          row.amount,
          row.description,
          row.status,
          row.metadata,
          row.created_at,
          row.processed_at
        ]);
      }
      console.log('Dados migrados com sucesso');
    }
    
    // 6. Verificar estrutura final
    const structure = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'transactions'
      ORDER BY ordinal_position
    `);
    
    console.log('\nEstrutura final da tabela transactions:');
    console.table(structure.rows);
    
    // 7. Verificar dados migrados
    const finalData = await client.query('SELECT * FROM transactions');
    console.log(`\nTotal de transações após migração: ${finalData.rows.length}`);
    if (finalData.rows.length > 0) {
      console.log('Dados migrados:');
      console.table(finalData.rows);
    }
    
    console.log('\nMigração concluída com sucesso!');
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateTransactions();