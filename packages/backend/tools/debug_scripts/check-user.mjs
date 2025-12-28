import { pool, initializeDatabase } from './src/utils/db.js';

async function checkUser() {
  await initializeDatabase();
  
  try {
    console.log('Verificando usuário josiassm701@gmail.com...');
    
    // Verificar se o usuário existe
    const result = await pool.query(
      'SELECT id, name, email, password, secret_phrase, pix_key, balance, created_at, referral_code, is_admin FROM users WHERE email = $1',
      ['josiassm701@gmail.com']
    );
    
    console.log('Resultado da consulta:', result.rows);
    
    if (result.rows.length === 0) {
      console.log('❌ Usuário NÃO encontrado no banco');
      
      // Listar todos os usuários
      const allUsers = await pool.query('SELECT id, name, email, is_admin FROM users');
      console.log('Todos os usuários no banco:', allUsers.rows);
    } else {
      console.log('✅ Usuário encontrado:');
      console.log('ID:', result.rows[0].id);
      console.log('Nome:', result.rows[0].name);
      console.log('Email:', result.rows[0].email);
      console.log('É Admin:', result.rows[0].is_admin);
      console.log('Senha Hash:', result.rows[0].password ? 'Sim' : 'Não');
      console.log('Frase Secreta:', result.rows[0].secret_phrase);
    }
    
    // Verificar transações pendentes
    const pendingTransactions = await pool.query(
      "SELECT * FROM transactions WHERE status = 'PENDING'"
    );
    console.log('Transações pendentes:', pendingTransactions.rows.length);
    pendingTransactions.rows.forEach((t, i) => {
      console.log(`  ${i+1}. ID: ${t.id}, Tipo: ${t.type}, Valor: ${t.amount}, Usuário: ${t.user_id}`);
    });
    
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
  } finally {
    await pool.end();
  }
}

checkUser();