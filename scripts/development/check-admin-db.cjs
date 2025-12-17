// Script para verificar administradores no banco de dados

const { Pool } = require('pg');

async function checkAdmins() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'cred30user',
    password: 'cred30pass',
    database: 'cred30',
  });

  try {
    console.log('Verificando administradores no banco de dados...');
    
    // Verificar todos os usuários
    const allUsersResult = await pool.query('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at');
    console.log('\nTodos os usuários:');
    allUsersResult.rows.forEach(user => {
      console.log(`ID: ${user.id}, Nome: ${user.name}, Email: ${user.email}, Admin: ${user.is_admin}, Criado: ${user.created_at}`);
    });
    
    // Verificar apenas administradores
    const adminResult = await pool.query('SELECT id, name, email, is_admin, created_at FROM users WHERE is_admin = TRUE ORDER BY created_at');
    console.log('\nAdministradores:');
    if (adminResult.rows.length === 0) {
      console.log('❌ Nenhum administrador encontrado no banco!');
    } else {
      adminResult.rows.forEach(admin => {
        console.log(`ID: ${admin.id}, Nome: ${admin.name}, Email: ${admin.email}, Admin: ${admin.is_admin}, Criado: ${admin.created_at}`);
      });
    }
    
    // Verificar se há algum problema com os tipos de dados
    console.log('\nVerificando tipos de dados...');
    const typeCheckResult = await pool.query('SELECT id, name, email, is_admin, typeof(is_admin) as admin_type FROM users LIMIT 5');
    typeCheckResult.rows.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, is_admin: ${user.is_admin} (tipo: ${user.admin_type})`);
    });
    
  } catch (error) {
    console.error('Erro ao verificar administradores:', error);
  } finally {
    await pool.end();
  }
}

checkAdmins();