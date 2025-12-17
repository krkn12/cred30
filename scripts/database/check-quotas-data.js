const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function checkQuotasData() {
  const client = await pool.connect();
  try {
    console.log('Verificando dados na tabela quotas...');
    
    // Verificar se há cotas e seus valores
    const result = await client.query(`
      SELECT id, user_id, purchase_price, current_value, purchase_date, status 
      FROM quotas 
      WHERE user_id = $1
      LIMIT 5
    `, [1]); // ID do usuário josias
    
    console.log('Cotas encontradas:');
    console.table(result.rows);
    
    // Verificar se há valores NULL
    const nullCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN purchase_price IS NULL THEN 1 END) as null_purchase_price,
        COUNT(CASE WHEN current_value IS NULL THEN 1 END) as null_current_value,
        COUNT(CASE WHEN purchase_date IS NULL THEN 1 END) as null_purchase_date
      FROM quotas 
      WHERE user_id = $1
    `, [1]);
    
    console.log('\nVerificação de valores NULL:');
    console.table(nullCheck.rows);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkQuotasData();