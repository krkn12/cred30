// Script para resetar o banco de dados e testar do zero
const API_BASE_URL = 'http://localhost:3001/api';

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`Erro: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function resetDatabase() {
  console.log('=== RESET DO BANCO DE DADOS ===\n');
  
  try {
    // 1. Criar usuário admin manualmente
    console.log('1. Criando usuário administrador manualmente...');
    const timestamp = Date.now();
    
    // Primeiro, vamos tentar criar um usuário para ver se já existe admin
    const testResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: `test${timestamp}@example.com`,
        password: '123456',
        secretPhrase: 'test123',
        pixKey: 'test@pix.com'
      })
    });
    
    console.log('Resposta do registro:', testResponse.data.user.isAdmin);
    
    // 2. Tentar criar um admin manualmente via SQL direto
    console.log('\n2. Verificando estado atual do banco...');
    
    // Vamos verificar se há uma rota para limpar admins
    try {
      const clearResponse = await apiRequest('/admin/clear-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✓ Admins limpos:', clearResponse.message);
    } catch (error) {
      console.log('❌ Rota de limpar admins não encontrada');
    }
    
    // 3. Tentar criar novo usuário após limpar
    console.log('\n3. Criando novo usuário após limpar...');
    const newTimestamp = Date.now();
    const newResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Novo Admin',
        email: `novo${newTimestamp}@example.com`,
        password: '123456',
        secretPhrase: 'novo123',
        pixKey: 'novo@pix.com'
      })
    });
    
    const newToken = newResponse.data.token;
    const newIsAdmin = newResponse.data.user.isAdmin;
    
    console.log('✓ Novo usuário criado');
    console.log(`   ID: ${newResponse.data.user.id}`);
    console.log(`   Email: novo${newTimestamp}@example.com`);
    console.log(`   É admin: ${newIsAdmin}`);
    
    // 4. Testar acesso admin
    console.log('\n4. Testando acesso admin...');
    try {
      const adminStats = await apiRequest('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      });
      console.log('✓ Acesso admin funcionando!');
      console.log('Stats:', adminStats.data);
    } catch (error) {
      console.log('❌ Acesso admin falhou:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o reset:', error.message);
  }
}

resetDatabase();