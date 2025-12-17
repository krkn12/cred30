import { Pool } from 'pg';

// Configuração do banco de dados
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'cred30user',
  password: 'cred30pass',
  database: 'cred30'
});

async function testAdminCreation() {
  console.log('🧪 Testando criação de administrador...\n');
  
  try {
    // 1. Verificar administradores existentes
    console.log('1️⃣ Verificando administradores existentes...');
    const adminCheck = await pool.query('SELECT id, name, email, is_admin FROM users WHERE is_admin = TRUE');
    
    if (adminCheck.rows.length > 0) {
      console.log('❌ Já existem administradores:');
      adminCheck.rows.forEach(admin => {
        console.log(`   - ID: ${admin.id}, Nome: ${admin.name}, Email: ${admin.email}`);
      });
      
      // Limpar administradores existentes
      console.log('\n🧹 Limpando administradores existentes...');
      await pool.query('UPDATE users SET is_admin = FALSE WHERE is_admin = TRUE');
      console.log('✅ Administradores removidos com sucesso!');
    } else {
      console.log('✅ Nenhum administrador encontrado. Ótimo!');
    }
    
    // 2. Verificar se a rota de registro está funcionando
    console.log('\n2️⃣ Testando lógica do primeiro usuário como administrador...');
    
    // Simular a verificação que a rota de registro faz
    const adminCheckResult = await pool.query(
      'SELECT id FROM users WHERE is_admin = TRUE LIMIT 1'
    );
    
    const isFirstUser = adminCheckResult.rows.length === 0;
    console.log(`   - Primeiro usuário será admin: ${isFirstUser ? 'SIM ✅' : 'NÃO ❌'}`);
    
    // 3. Mostrar instruções para teste manual
    console.log('\n📋 Instruções para teste manual:');
    console.log('1. Inicie o backend: npm run dev');
    console.log('2. Abra o frontend: http://localhost:5173');
    console.log('3. Registre um novo usuário');
    console.log('4. Verifique se o usuário foi criado como administrador');
    console.log('5. Faça login como administrador');
    console.log('6. Solicite um empréstimo como cliente');
    console.log('7. Aprove o empréstimo como administrador');
    console.log('8. Verifique se o saldo foi atualizado no frontend');
    
    console.log('\n🔍 Para verificar manualmente no banco:');
    console.log('SELECT id, name, email, is_admin FROM users ORDER BY created_at DESC LIMIT 1;');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await pool.end();
  }
}

testAdminCreation();