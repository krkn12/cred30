// Teste para verificar se o primeiro usuário é realmente admin
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

async function testarAdmin() {
  console.log('=== TESTE DE VERIFICAÇÃO DE ADMIN ===\n');
  
  try {
    // 1. Criar primeiro usuário
    console.log('1. Criando primeiro usuário...');
    const timestamp = Date.now();
    const registerResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Primeiro Usuário',
        email: `primeiro${timestamp}@example.com`,
        password: '123456',
        secretPhrase: 'primeiro123',
        pixKey: 'primeiro@pix.com'
      })
    });
    
    const firstUserToken = registerResponse.data.token;
    const firstUserId = registerResponse.data.user.id;
    console.log('✓ Primeiro usuário criado');
    console.log(`   ID: ${firstUserId}`);
    console.log(`   Email: primeiro${timestamp}@example.com`);
    
    // 2. Verificar se é admin tentando acessar rota admin
    console.log('\n2. Verificando se primeiro usuário é admin...');
    try {
      const adminResponse = await apiRequest('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${firstUserToken}`
        }
      });
      console.log('✓ Primeiro usuário tem acesso admin!');
      console.log('   Resposta:', JSON.stringify(adminResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Primeiro usuário NÃO tem acesso admin');
      console.log('   Erro:', error.message);
    }
    
    // 3. Criar segundo usuário
    console.log('\n3. Criando segundo usuário...');
    const secondUserResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Segundo Usuário',
        email: `segundo${timestamp}@example.com`,
        password: '123456',
        secretPhrase: 'segundo123',
        pixKey: 'segundo@pix.com'
      })
    });
    
    const secondUserToken = secondUserResponse.data.token;
    const secondUserId = secondUserResponse.data.user.id;
    console.log('✓ Segundo usuário criado');
    console.log(`   ID: ${secondUserId}`);
    
    // 4. Verificar se segundo usuário é admin
    console.log('\n4. Verificando se segundo usuário é admin...');
    try {
      const adminResponse = await apiRequest('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${secondUserToken}`
        }
      });
      console.log('❌ Segundo usuário NÃO deveria ter acesso admin!');
    } catch (error) {
      console.log('✓ Segundo usuário corretamente não tem acesso admin');
      console.log('   Erro:', error.message);
    }
    
    // 5. Tentar aprovar empréstimo com primeiro usuário
    console.log('\n5. Testando aprovação de empréstimo com primeiro usuário...');
    
    // Primeiro solicitar um empréstimo
    const loanResponse = await apiRequest('/loans/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firstUserToken}`
      },
      body: JSON.stringify({
        amount: 50,
        installments: 1,
        receivePixKey: 'teste@pix.com'
      })
    });
    
    const loanId = loanResponse.data.loanId;
    console.log(`✓ Empréstimo solicitado: ID ${loanId}`);
    
    // Tentar aprovar
    try {
      await apiRequest('/admin/process-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firstUserToken}`
        },
        body: JSON.stringify({
          id: loanId,
          type: 'LOAN',
          action: 'APPROVE'
        })
      });
      console.log('✓ Primeiro usuário conseguiu aprovar empréstimo!');
    } catch (error) {
      console.log('❌ Primeiro usuário NÃO conseguiu aprovar empréstimo');
      console.log('   Erro:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testarAdmin();