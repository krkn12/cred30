// Script para debug do problema de admin via API

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
  const response = await authenticatedRequest('/users/profile', token);
  return response.data;
}

// Função principal
async function debugAdminViaAPI() {
  console.log('=== DEBUG DO PROBLEMA DE ADMIN VIA API ===\n');
  
  try {
    // 1. Verificar se existe algum admin no sistema
    console.log('1. Verificando se existe algum admin...');
    
    // Tentar login com diferentes emails para ver se algum é admin
    const testEmails = [
      'admin@test.com',
      'user@test.com',
      'josiassm701@gmail.com'
    ];
    
    for (const email of testEmails) {
      try {
        console.log(`\nTentando login com: ${email}`);
        const tempToken = await login(email, '123456', 'admin123');
        console.log('✓ Login realizado com sucesso');
        
        const profile = await getUserProfile(tempToken);
        console.log('✓ Perfil obtido:');
        console.log(`   ID: ${profile.user.id}`);
        console.log(`   Nome: ${profile.user.name}`);
        console.log(`   Email: ${profile.user.email}`);
        console.log(`   Admin: ${profile.user.isAdmin}`);
        console.log(`   Admin Type: ${typeof profile.user.isAdmin}`);
        
        if (profile.user.isAdmin) {
          console.log('\n🎉 USUÁRIO É ADMINISTRADOR!');
          console.log('Email:', email);
          console.log('Senha: 123456');
          console.log('Frase Secreta: admin123');
          console.log('Token:', tempToken);
          return tempToken;
        }
      } catch (error) {
        console.log(`❌ Falha no login com ${email}:`, error.message);
      }
    }
    
    // 2. Se não encontrou admin, criar um novo
    console.log('\n2. Nenhum admin encontrado, criando novo admin...');
    
    const timestamp = Date.now();
    const newAdminEmail = `admin${timestamp}@test.com`;
    
    const adminData = await registerUser(
      'Admin Test',
      newAdminEmail,
      '123456',
      'admin123',
      'admin@pix.com'
    );
    
    console.log('✓ Novo admin criado com sucesso');
    console.log('✓ Email:', newAdminEmail);
    console.log('✓ Admin é administrador?', adminData.user.isAdmin);
    console.log('✓ Admin Type:', typeof adminData.user.isAdmin);
    
    // 3. Verificar novamente se o novo admin foi definido corretamente
    console.log('\n3. Verificando novo admin...');
    const newProfile = await getUserProfile(adminData.token);
    console.log('✓ Perfil do novo admin:');
    console.log(`   ID: ${newProfile.user.id}`);
    console.log(`   Nome: ${newProfile.user.name}`);
    console.log(`   Email: ${newProfile.user.email}`);
    console.log(`   Admin: ${newProfile.user.isAdmin}`);
    console.log(`   Admin Type: ${typeof newProfile.user.isAdmin}`);
    
    if (newProfile.user.isAdmin) {
      console.log('\n🎉 SUCESSO: Novo admin criado corretamente!');
      console.log('\n=== RESUMO PARA USO ===');
      console.log('Email do admin:', newAdminEmail);
      console.log('Senha: 123456');
      console.log('Frase Secreta: admin123');
      console.log('Token:', adminData.token);
      console.log('Agora você pode usar este admin para testar aprovação de empréstimos');
    } else {
      console.log('\n❌ PROBLEMA: Novo admin não foi definido como administrador');
      console.log('Isso indica um problema na lógica do backend');
    }
    
  } catch (error) {
    console.error('❌ Erro durante debug:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== FIM DO DEBUG ===');
}

// Executar debug
debugAdminViaAPI();