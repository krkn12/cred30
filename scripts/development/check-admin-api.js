// Script para verificar administradores via API

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

// Função para obter perfil do usuário
async function getUserProfile(token) {
  const response = await apiRequest('/users/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.data;
}

// Função principal
async function checkAdmins() {
  console.log('=== VERIFICANDO ADMINISTRADORES VIA API ===\n');
  
  try {
    // Tentar login com diferentes usuários para verificar quem é admin
    const testUsers = [
      { email: 'admin@test.com', password: '123456', secretPhrase: 'admin123' },
      { email: 'user@test.com', password: '123456', secretPhrase: 'user123' },
      { email: 'josiassm701@gmail.com', password: '123456', secretPhrase: 'teste123' }
    ];
    
    for (const testUser of testUsers) {
      try {
        console.log(`\n1. Tentando login com: ${testUser.email}`);
        const token = await login(testUser.email, testUser.password, testUser.secretPhrase);
        console.log('✓ Login realizado com sucesso');
        
        console.log('2. Obtendo perfil do usuário...');
        const profile = await getUserProfile(token);
        console.log('✓ Perfil obtido:');
        console.log(`   ID: ${profile.user.id}`);
        console.log(`   Nome: ${profile.user.name}`);
        console.log(`   Email: ${profile.user.email}`);
        console.log(`   Admin: ${profile.user.isAdmin}`);
        console.log(`   Saldo: ${profile.user.balance}`);
        
        if (profile.user.isAdmin) {
          console.log('\n🎉 USUÁRIO É ADMINISTRADOR!');
          
          // Tentar acessar dashboard admin
          console.log('\n3. Tentando acessar dashboard admin...');
          try {
            const dashboardResponse = await fetch(`${API_BASE_URL}/admin/dashboard`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (dashboardResponse.ok) {
              const dashboard = await dashboardResponse.json();
              console.log('✓ Dashboard admin acessado com sucesso!');
              console.log(`   Total de usuários: ${dashboard.data?.stats?.usersCount || 'N/A'}`);
              console.log(`   Cotas ativas: ${dashboard.data?.stats?.quotasCount || 'N/A'}`);
              console.log(`   Empréstimos pendentes: ${dashboard.data?.pendingLoans?.length || 0}`);
            } else {
              const error = await dashboardResponse.json();
              console.log('❌ Erro ao acessar dashboard:', error.message);
            }
          } catch (error) {
            console.log('❌ Erro ao acessar dashboard:', error.message);
          }
        }
      } catch (error) {
        console.log(`❌ Falha no login com ${testUser.email}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  }
  
  console.log('\n=== FIM DA VERIFICAÇÃO ===');
}

// Executar verificação
checkAdmins();