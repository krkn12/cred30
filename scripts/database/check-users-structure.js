const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function checkUsersStructure() {
  const client = await pool.connect();
  try {
    console.log('Verificando estrutura da tabela users...');
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Estrutura da tabela users:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsersStructure();