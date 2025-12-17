// Script para debug do problema de atualização de saldo após aprovação de empréstimo

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

// Função para obter dashboard admin
async function getAdminDashboard(token) {
  const response = await apiRequest('/admin/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.data;
}

// Função para aprovar empréstimo
async function approveLoan(loanId, token) {
  const response = await apiRequest('/admin/process-action', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: loanId,
      type: 'LOAN',
      action: 'APPROVE'
    }),
  });
  
  return response.data;
}

// Função principal de teste
async function testSaldoAtualizacao() {
  console.log('=== INÍCIO DO TESTE DE ATUALIZAÇÃO DE SALDO ===\n');
  
  try {
    // 1. Login como admin
    console.log('1. Fazendo login como administrador...');
    const adminToken = await login('josiassm701@gmail.com', '123456', 'teste123');
    console.log('✓ Login admin realizado com sucesso');
    
    // 2. Obter dashboard admin antes da aprovação
    console.log('\n2. Obtendo dashboard admin antes da aprovação...');
    const dashboardBefore = await getAdminDashboard(adminToken);
    const pendingLoans = dashboardBefore.pendingLoans || [];
    
    if (pendingLoans.length === 0) {
      console.log('❌ Nenhum empréstimo pendente encontrado para testar');
      return;
    }
    
    const loanToApprove = pendingLoans[0];
    console.log(`✓ Encontrado empréstimo pendente: ID ${loanToApprove.id}, Valor: R$ ${loanToApprove.amount}`);
    
    // 3. Obter saldo do usuário antes da aprovação
    console.log('\n3. Verificando saldo do usuário antes da aprovação...');
    const userProfileBefore = await getUserProfile(adminToken);
    console.log(`✓ Saldo do usuário antes: R$ ${userProfileBefore.user.balance}`);
    
    // 4. Aprovar empréstimo
    console.log('\n4. Aprovando empréstimo...');
    await approveLoan(loanToApprove.id, adminToken);
    console.log('✓ Empréstimo aprovado com sucesso');
    
    // 5. Aguardar um momento para processamento
    console.log('\n5. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 6. Obter saldo do usuário após aprovação
    console.log('\n6. Verificando saldo do usuário após aprovação...');
    const userProfileAfter = await getUserProfile(adminToken);
    console.log(`✓ Saldo do usuário após: R$ ${userProfileAfter.user.balance}`);
    
    // 7. Calcular diferença
    const balanceBefore = parseFloat(userProfileBefore.user.balance) || 0;
    const balanceAfter = parseFloat(userProfileAfter.user.balance) || 0;
    const difference = balanceAfter - balanceBefore;
    const loanAmount = parseFloat(loanToApprove.amount) || 0;
    
    console.log('\n=== RESULTADOS ===');
    console.log(`Saldo antes: R$ ${balanceBefore.toFixed(2)}`);
    console.log(`Saldo após: R$ ${balanceAfter.toFixed(2)}`);
    console.log(`Diferença: R$ ${difference.toFixed(2)}`);
    console.log(`Valor do empréstimo: R$ ${loanAmount.toFixed(2)}`);
    console.log(`Saldo atualizado corretamente? ${difference === loanAmount ? '✓ SIM' : '❌ NÃO'}`);
    
    if (difference !== loanAmount) {
      console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
      console.log('O saldo não foi atualizado corretamente após a aprovação do empréstimo');
      console.log('Possíveis causas:');
      console.log('1. Cache no frontend impedindo atualização');
      console.log('2. Erro na atualização do saldo no backend');
      console.log('3. Problema na conversão de tipos (string vs number)');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
  
  console.log('\n=== FIM DO TESTE ===');
}

// Executar teste
testSaldoAtualizacao();