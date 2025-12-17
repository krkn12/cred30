const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function fixQuotasStructure() {
  const client = await pool.connect();
  try {
    console.log('Verificando estrutura atual da tabela quotas...');
    
    // Verificar se a tabela existe primeiro
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'quotas'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Tabela quotas não existe. Criando com estrutura correta...');
      
      // Criar extensão UUID se não existir
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // Criar tabela com estrutura correta (usando integer para compatibilidade)
      await client.query(`
        CREATE TABLE quotas (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          purchase_price DECIMAL(10,2) NOT NULL,
          current_value DECIMAL(10,2) NOT NULL,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'ACTIVE'
        );
      `);
      
      console.log('Tabela quotas criada com sucesso!');
    } else {
      // Verificar estrutura atual
      const currentStructure = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'quotas'
        ORDER BY ordinal_position
      `);
      
      console.log('Estrutura atual:');
      console.table(currentStructure.rows);
      
      // Verificar se há dados
      const dataCheck = await client.query('SELECT COUNT(*) as count FROM quotas');
      const hasData = parseInt(dataCheck.rows[0].count) > 0;
      
      console.log(`\nDados existentes: ${hasData}`);
      
      if (!hasData) {
        console.log('Recriando tabela quotas com estrutura correta...');
        
        // Dropar tabela atual
        await client.query('DROP TABLE quotas');
        
        // Recriar com estrutura correta baseada no código (usando integer para compatibilidade)
        await client.query(`
          CREATE TABLE quotas (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            purchase_price DECIMAL(10,2) NOT NULL,
            current_value DECIMAL(10,2) NOT NULL,
            purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'ACTIVE'
          );
        `);
        
        console.log('Tabela quotas recriada com sucesso!');
      } else {
        console.log('Adicionando colunas ausentes...');
        
        // Adicionar colunas ausentes uma por uma
        const columnsToAdd = [
          { name: 'purchase_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
        ];
        
        for (const column of columnsToAdd) {
          try {
            await client.query(`
              ALTER TABLE quotas
              ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}
            `);
            console.log(`Coluna ${column.name} adicionada com sucesso!`);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.log(`Erro ao adicionar ${column.name}:`, error.message);
            }
          }
        }
      }
    }
    
    // Verificar estrutura final
    const finalStructure = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'quotas'
      ORDER BY ordinal_position
    `);
    
    console.log('\nEstrutura final da tabela quotas:');
    console.table(finalStructure.rows);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixQuotasStructure();