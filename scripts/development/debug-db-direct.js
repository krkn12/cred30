// Script para debug direto no banco de dados

const { Pool } = require('pg');

async function debugDatabase() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'cred30user',
    password: 'cred30pass',
    database: 'cred30',
  });

  try {
    console.log('=== DEBUG DIRETO NO BANCO ===\n');
    
    // 1. Verificar estrutura da tabela users
    console.log('1. Verificando estrutura da tabela users...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);
    console.log('Estrutura da coluna is_admin:', tableInfo.rows);
    
    // 2. Verificar todos os dados da tabela users
    console.log('\n2. Verificando todos os usuários...');
    const allUsers = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');
    allUsers.rows.forEach((user, index) => {
      console.log(`Usuário ${index + 1}:`, {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        is_admin_type: typeof user.is_admin,
        created_at: user.created_at
      });
    });
    
    // 3. Verificar se há algum administrador
    console.log('\n3. Verificando administradores...');
    const adminUsers = await pool.query('SELECT * FROM users WHERE is_admin = true');
    console.log('Administradores encontrados:', adminUsers.rows.length);
    adminUsers.rows.forEach((admin, index) => {
      console.log(`Admin ${index + 1}:`, {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        is_admin: admin.is_admin,
        is_admin_type: typeof admin.is_admin
      });
    });
    
    // 4. Testar inserção manual
    console.log('\n4. Testando inserção manual de admin...');
    const testEmail = `testadmin${Date.now()}@test.com`;
    const insertResult = await pool.query(`
      INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, name, email, is_admin
    `, [
      'Test Admin Manual',
      testEmail,
      'hashed_password',
      'test123',
      'test@pix.com',
      0,
      'TEST123',
      true
    ]);
    
    console.log('Inserção manual result:', insertResult.rows[0]);
    
    // 5. Verificar se o admin manual foi inserido corretamente
    console.log('\n5. Verificando admin manual inserido...');
    const verifyAdmin = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    console.log('Verificação do admin manual:', verifyAdmin.rows[0]);
    
    // 6. Limpar teste
    console.log('\n6. Limpando teste...');
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
    console.log('Teste limpo');
    
  } catch (error) {
    console.error('Erro durante debug:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();