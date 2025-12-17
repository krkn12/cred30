// Script para debug direto no banco de dados

const { Pool } = require('pg');
const path = require('path');

async function debugDatabase() {
  // Caminho absoluto para evitar problemas
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..');
  
  console.log('Diretório atual:', __dirname);
  console.log('Raiz do projeto:', projectRoot);
  
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
    const allUsers = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 10');
    allUsers.rows.forEach((user, index) => {
      console.log(`Usuário ${index + 1}:`, {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        is_admin_type: typeof user.is_admin,
        is_admin_string: JSON.stringify(user.is_admin),
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
        is_admin_type: typeof admin.is_admin,
        is_admin_string: JSON.stringify(admin.is_admin)
      });
    });
    
    // 4. Testar inserção manual com diferentes valores
    console.log('\n4. Testando inserção manual com diferentes valores...');
    
    // Teste 1: Usar true literal
    console.log('Teste 1: Usando true literal');
    try {
      const test1 = await pool.query(`
        INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id, name, email, is_admin
      `, [
        'Test Admin 1',
        'testadmin1@test.com',
        'hashed_password',
        'test123',
        'test@pix.com',
        0,
        'TEST123'
      ]);
      console.log('Resultado Teste 1:', test1.rows[0]);
    } catch (error) {
      console.log('Erro no Teste 1:', error.message);
    }
    
    // Teste 2: Usar 1
    console.log('\nTeste 2: Usando 1');
    try {
      const test2 = await pool.query(`
        INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
        RETURNING id, name, email, is_admin
      `, [
        'Test Admin 2',
        'testadmin2@test.com',
        'hashed_password',
        'test123',
        'test@pix.com',
        0,
        'TEST123'
      ]);
      console.log('Resultado Teste 2:', test2.rows[0]);
    } catch (error) {
      console.log('Erro no Teste 2:', error.message);
    }
    
    // Teste 3: Usar 'true' string
    console.log('\nTeste 3: Usando "true" string');
    try {
      const test3 = await pool.query(`
        INSERT INTO users (name, email, password, secret_phrase, pix_key, balance, referral_code, is_admin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'true')
        RETURNING id, name, email, is_admin
      `, [
        'Test Admin 3',
        'testadmin3@test.com',
        'hashed_password',
        'test123',
        'test@pix.com',
        0,
        'TEST123'
      ]);
      console.log('Resultado Teste 3:', test3.rows[0]);
    } catch (error) {
      console.log('Erro no Teste 3:', error.message);
    }
    
    // 5. Limpar testes
    console.log('\n5. Limpando testes...');
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['testadmin%@test.com']);
    console.log('Testes limpos');
    
    // 6. Verificar estado final
    console.log('\n6. Estado final da tabela users:');
    const finalUsers = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN is_admin = true THEN 1 END) as admins FROM users');
    console.log('Total de usuários:', finalUsers.rows[0].total);
    console.log('Total de administradores:', finalUsers.rows[0].admins);
    
  } catch (error) {
    console.error('Erro durante debug:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();