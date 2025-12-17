// Script para limpar administradores e criar um novo

const API_BASE_URL = 'http://localhost:3001/api';

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }
  
  return data;
}

// Função para login
async function login(email, password, secretPhrase) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, secretPhrase }),
  });
  
  return response.data.token;
}

// Função para registro
async function registerUser(name, email, password, secretPhrase, pixKey) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, secretPhrase, pixKey }),
  });
  
  return response.data;
}

// Função para obter perfil
async function getUserProfile(token) {
  const response = await apiRequest('/users/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.data;
}

// Função para fazer requisições autenticadas
async function authenticatedRequest(endpoint, token, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }
  
  return data;
}

// Função principal
async function createCleanAdmin() {
  console.log('=== CRIANDO ADMIN LIMPO ===\n');
  
  try {
    // 1. Resetar banco completamente
    console.log('1. Resetando banco de dados...');
    try {
      await apiRequest('/reset-database', {
        method: 'POST',
      });
      console.log('✓ Banco resetado com sucesso');
    } catch (error) {
      console.log('❌ Erro ao resetar banco (pode não ter a rota):', error.message);
    }
    
    // 2. Criar novo admin (será o primeiro usuário)
    console.log('\n2. Criando novo administrador...');
    const timestamp = Date.now();
    const adminEmail = `admin${timestamp}@test.com`;
    
    const adminData = await registerUser(
      'Admin Test',
      adminEmail,
      '123456',
      'admin123',
      'admin@pix.com'
    );
    
    console.log('✓ Admin criado com sucesso');
    console.log('✓ Email:', adminEmail);
    console.log('✓ Token obtido');
    
    // 3. Verificar se foi definido como admin
    console.log('\n3. Verificando se foi definido como administrador...');
    const profile = await getUserProfile(adminData.token);
    console.log('✓ Perfil obtido:');
    console.log(`   ID: ${profile.user.id}`);
    console.log(`   Nome: ${profile.user.name}`);
    console.log(`   Email: ${profile.user.email}`);
    console.log(`   Admin: ${profile.user.isAdmin}`);
    
    if (profile.user.isAdmin) {
      console.log('\n🎉 SUCESSO: Administrador criado corretamente!');
      
      // 4. Testar acesso ao dashboard admin
      console.log('\n4. Testando acesso ao dashboard admin...');
      try {
        const dashboard = await authenticatedRequest('/admin/dashboard', adminData.token);
        console.log('✓ Dashboard admin acessado com sucesso!');
        console.log(`   Total de usuários: ${dashboard.data?.stats?.usersCount || 'N/A'}`);
        console.log(`   Cotas ativas: ${dashboard.data?.stats?.quotasCount || 'N/A'}`);
        
        console.log('\n=== ADMIN PRONTO PARA USO ===');
        console.log('Email:', adminEmail);
        console.log('Senha: 123456');
        console.log('Frase Secreta: admin123');
        console.log('Token:', adminData.token);
        
      } catch (error) {
        console.log('❌ Erro ao acessar dashboard:', error.message);
      }
    } else {
      console.log('\n❌ PROBLEMA: Usuário não foi definido como administrador');
    }
    
  } catch (error) {
    console.error('❌ Erro durante processo:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar
createCleanAdmin();