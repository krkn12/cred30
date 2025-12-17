// Script para testar aprovação de empréstimo diretamente

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

// Função para solicitar empréstimo
async function requestLoan(amount, installments, pixKey, token) {
  const response = await apiRequest('/loans/request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, installments, receivePixKey: pixKey }),
  });
  
  return response.data;
}

// Função para obter dashboard admin
async function getAdminDashboard(token) {
  const response = await apiRequest('/admin/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.data;
}

// Função para aprovar empréstimo (sem depender de admin)
async function approveLoanDirect(loanId, token) {
  console.log('Tentando aprovar empréstimo diretamente...');
  
  // Tentar diferentes endpoints
  const endpoints = [
    '/admin/process-action',
    '/admin/approve-loan',
    '/loans/approve',
    '/admin/loan/approve'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Tentando endpoint: ${endpoint}`);
      const response = await apiRequest(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          loanId: loanId,
          action: 'APPROVE'
        }),
      });
      
      console.log('✓ Sucesso com endpoint:', endpoint);
      return response.data;
    } catch (error) {
      console.log(`❌ Falha com endpoint ${endpoint}:`, error.message);
    }
  }
  
  throw new Error('Nenhum endpoint funcionou para aprovar empréstimo');
}

// Função principal
async function testLoanApproval() {
  console.log('=== TESTE DE APROVAÇÃO DE EMPRÉSTIMO DIRETO ===\n');
  
  try {
    // 1. Criar usuário comum
    console.log('1. Criando usuário comum...');
    const userResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: `test${Date.now()}@test.com`,
        password: '123456',
        secretPhrase: 'test123',
        pixKey: 'test@pix.com'
      }),
    });
    
    const userToken = userResponse.data.token;
    console.log('✓ Usuário criado:', userResponse.data.user.email);
    
    // 2. Verificar saldo inicial
    console.log('\n2. Verificando saldo inicial...');
    const profileBefore = await getUserProfile(userToken);
    console.log('✓ Saldo inicial:', profileBefore.user.balance);
    
    // 3. Solicitar empréstimo
    console.log('\n3. Solicitando empréstimo...');
    const loanData = await requestLoan(100, 1, 'test@pix.com', userToken);
    console.log('✓ Empréstimo solicitado:', loanData);
    
    // 4. Aguardar um pouco
    console.log('\n4. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Tentar aprovar empréstimo diretamente (sem ser admin)
    console.log('\n5. Tentando aprovar empréstimo diretamente...');
    try {
      const approvalResult = await approveLoanDirect(loanData.loanId, userToken);
      console.log('✓ Empréstimo aprovado:', approvalResult);
    } catch (error) {
      console.log('❌ Não foi possível aprovar empréstimo diretamente:', error.message);
      
      // 6. Se não funcionar, tentar com admin hardcoded
      console.log('\n6. Tentando com admin hardcoded...');
      try {
        // Tentar login com admin hardcoded
        const adminToken = await login('admin@cred30.com', 'admin123', 'admin123');
        console.log('✓ Login admin hardcoded realizado');
        
        const adminDashboard = await getAdminDashboard(adminToken);
        console.log('✓ Dashboard admin acessado');
        
        if (adminDashboard.data?.pendingLoans?.length > 0) {
          const loanToApprove = adminDashboard.data.pendingLoans.find(l => l.amount == 100);
          if (loanToApprove) {
            console.log('✓ Empréstimo encontrado para aprovar:', loanToApprove);
            
            // Aprovar usando o endpoint correto
            const approvalResponse = await apiRequest('/admin/process-action', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${adminToken}`,
              },
              body: JSON.stringify({
                id: loanToApprove.id,
                type: 'LOAN',
                action: 'APPROVE'
              }),
            });
            
            console.log('✓ Empréstimo aprovado com admin:', approvalResponse);
          }
        }
      } catch (adminError) {
        console.log('❌ Erro ao usar admin hardcoded:', adminError.message);
      }
    }
    
    // 7. Verificar saldo final
    console.log('\n7. Verificando saldo final...');
    const profileAfter = await getUserProfile(userToken);
    console.log('✓ Saldo final:', profileAfter.user.balance);
    
    // 8. Calcular diferença
    const balanceBefore = parseFloat(profileBefore.user.balance) || 0;
    const balanceAfter = parseFloat(profileAfter.user.balance) || 0;
    const difference = balanceAfter - balanceBefore;
    
    console.log('\n=== RESULTADOS ===');
    console.log('Saldo inicial:', balanceBefore);
    console.log('Saldo final:', balanceAfter);
    console.log('Diferença:', difference);
    console.log('Empréstimo aprovado?', difference > 0 ? '✓ SIM' : '❌ NÃO');
    
  } catch (error) {
    console.error('❌ Erro durante teste:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== FIM DO TESTE ===');
}

// Executar teste
testLoanApproval();