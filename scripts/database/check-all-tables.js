const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function checkAllTables() {
  const client = await pool.connect();
  try {
    const tables = ['transactions', 'loans', 'loan_installments'];
    
    for (const table of tables) {
      console.log(`\nVerificando tabela: ${table}`);
      
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${table}'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        const result = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
          AND (column_name = 'id' OR column_name = 'user_id' OR column_name = 'loan_id')
          ORDER BY ordinal_position
        `);
        
        console.log(`Estrutura da tabela ${table}:`);
        console.table(result.rows);
      } else {
        console.log(`Tabela ${table} não existe`);
      }
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllTables();