// Script completo para testar o fluxo de aprovação de empréstimo e atualização de saldo

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

// Função para fazer requisições com autenticação
async function authenticatedRequest(endpoint, token, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...options,
  };

  console.log(`Fazendo requisição para ${endpoint} com token:`, token ? 'SIM' : 'NÃO');
  
  const response = await fetch(url, config);
  const data = await response.json();
  
  console.log(`Resposta de ${endpoint}:`, data);
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro na requisição');
  }
  
  return data;
}

// Função para registrar usuário
async function registerUser(name, email, password, secretPhrase, pixKey) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, secretPhrase, pixKey }),
  });
  
  return response.data;
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
  const response = await authenticatedRequest('/users/profile', token);
  return response.data;
}

// Função para obter dashboard admin
async function getAdminDashboard(token) {
  const response = await authenticatedRequest('/admin/dashboard', token);
  return response.data;
}

// Função para solicitar empréstimo
async function requestLoan(amount, installments, pixKey, token) {
  const response = await authenticatedRequest('/loans/request', token, {
    method: 'POST',
    body: JSON.stringify({ amount, installments, receivePixKey: pixKey }),
  });
  return response.data;
}

// Função para aprovar empréstimo
async function approveLoan(loanId, token) {
  const response = await authenticatedRequest('/admin/process-action', token, {
    method: 'POST',
    body: JSON.stringify({
      id: loanId,
      type: 'LOAN',
      action: 'APPROVE'
    }),
  });
  return response.data;
}

// Função principal de teste
async function testCompleteFlow() {
  console.log('=== INÍCIO DO TESTE COMPLETO ===\n');
  
  let adminToken = null;
  let userToken = null;
  
  try {
    // 1. Criar novo admin com email único
    console.log('1. Criando novo admin com email único...');
    try {
      const timestamp = Date.now();
      const adminEmail = `admin${timestamp}@test.com`;
      
      const adminData = await registerUser(
        'Admin Test',
        adminEmail,
        '123456',
        'admin123',
        'admin@pix.com'
      );
      adminToken = adminData.token;
      console.log('✓ Novo admin criado e logado com sucesso');
      console.log('✓ Email do admin:', adminEmail);
      console.log('✓ Admin é administrador?', adminData.user.isAdmin);
      
      // Aguardar um momento para garantir que o usuário foi salvo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar novamente o perfil do admin
      const adminProfile = await getUserProfile(adminToken);
      console.log('✓ Verificação pós-login - Admin é administrador?', adminProfile.user.isAdmin);
      
      // Se não for admin, tentar novamente com outro email
      if (!adminProfile.user.isAdmin) {
        console.log('❌ Admin não foi definido como administrador, tentando novamente...');
        const timestamp2 = Date.now() + 1;
        const adminEmail2 = `admin${timestamp2}@test.com`;
        
        const adminData2 = await registerUser(
          'Admin Test 2',
          adminEmail2,
          '123456',
          'admin123',
          'admin@pix.com'
        );
        adminToken = adminData2.token;
        console.log('✓ Segundo admin criado:', adminEmail2);
        console.log('✓ Segundo admin é administrador?', adminData2.user.isAdmin);
      }
    } catch (error) {
      console.error('❌ Erro ao criar admin:', error.message);
      throw error;
    }
    
    // 2. Criar usuário comum se não existir
    console.log('\n2. Criando usuário comum...');
    try {
      userToken = await login('user@test.com', '123456', 'user123');
      console.log('✓ Usuário comum já existe');
    } catch (error) {
      console.log('❌ Usuário não encontrado, criando novo usuário...');
      
      const userData = await registerUser(
        'User Test',
        'user@test.com',
        '123456',
        'user123',
        'user@pix.com'
      );
      userToken = userData.token;
      console.log('✓ Usuário criado e logado com sucesso');
    }
    
    // 3. Verificar saldo inicial do usuário
    console.log('\n3. Verificando saldo inicial do usuário...');
    const userProfileBefore = await getUserProfile(userToken);
    const initialBalance = parseFloat(userProfileBefore.user.balance) || 0;
    console.log(`✓ Saldo inicial: R$ ${initialBalance.toFixed(2)}`);
    
    // 4. Solicitar empréstimo
    console.log('\n4. Solicitando empréstimo...');
    const loanAmount = 100;
    const loanData = await requestLoan(loanAmount, 1, 'user@pix.com', userToken);
    console.log(`✓ Empréstimo solicitado: R$ ${loanAmount}`);
    
    // 5. Aguardar um momento
    console.log('\n5. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Obter dashboard admin para encontrar o empréstimo pendente
    console.log('\n6. Buscando empréstimos pendentes...');
    const dashboard = await getAdminDashboard(adminToken);
    const pendingLoans = dashboard.pendingLoans || [];
    
    if (pendingLoans.length === 0) {
      console.log('❌ Nenhum empréstimo pendente encontrado');
      return;
    }
    
    const loanToApprove = pendingLoans.find(l => l.amount == loanAmount);
    if (!loanToApprove) {
      console.log('❌ Empréstimo solicitado não encontrado na lista de pendentes');
      return;
    }
    
    console.log(`✓ Empréstimo encontrado: ID ${loanToApprove.id}, Valor: R$ ${loanToApprove.amount}`);
    
    // 7. Verificar saldo do usuário antes da aprovação
    console.log('\n7. Verificando saldo do usuário antes da aprovação...');
    const userProfileBeforeApproval = await getUserProfile(userToken);
    const balanceBeforeApproval = parseFloat(userProfileBeforeApproval.user.balance) || 0;
    console.log(`✓ Saldo antes da aprovação: R$ ${balanceBeforeApproval.toFixed(2)}`);
    
    // 8. Aprovar empréstimo
    console.log('\n8. Aprovando empréstimo...');
    await approveLoan(loanToApprove.id, adminToken);
    console.log('✓ Empréstimo aprovado com sucesso');
    
    // 9. Aguardar processamento
    console.log('\n9. Aguardando processamento da aprovação...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 10. Verificar saldo do usuário após aprovação
    console.log('\n10. Verificando saldo do usuário após aprovação...');
    const userProfileAfterApproval = await getUserProfile(userToken);
    const balanceAfterApproval = parseFloat(userProfileAfterApproval.user.balance) || 0;
    console.log(`✓ Saldo após aprovação: R$ ${balanceAfterApproval.toFixed(2)}`);
    
    // 11. Calcular e verificar diferença
    const difference = balanceAfterApproval - balanceBeforeApproval;
    
    console.log('\n=== RESULTADOS ===');
    console.log(`Saldo inicial: R$ ${initialBalance.toFixed(2)}`);
    console.log(`Saldo antes da aprovação: R$ ${balanceBeforeApproval.toFixed(2)}`);
    console.log(`Saldo após aprovação: R$ ${balanceAfterApproval.toFixed(2)}`);
    console.log(`Diferença após aprovação: R$ ${difference.toFixed(2)}`);
    console.log(`Valor do empréstimo: R$ ${loanAmount.toFixed(2)}`);
    console.log(`Saldo atualizado corretamente? ${difference === loanAmount ? '✓ SIM' : '❌ NÃO'}`);
    
    if (difference !== loanAmount) {
      console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
      console.log('O saldo não foi atualizado corretamente após a aprovação do empréstimo');
      console.log('Possíveis causas:');
      console.log('1. Cache no frontend impedindo atualização');
      console.log('2. Erro na atualização do saldo no backend');
      console.log('3. Problema na conversão de tipos (string vs number)');
      console.log('4. Problema de timing na atualização do banco de dados');
    } else {
      console.log('\n✅ SUCESSO: O saldo foi atualizado corretamente!');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== FIM DO TESTE ===');
}

// Executar teste
testCompleteFlow();