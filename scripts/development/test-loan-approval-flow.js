// Script para testar o fluxo completo de aprovação de empréstimo e saque
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

// Configuração de teste
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123'
};

const ADMIN_USER = {
  email: 'admin@example.com',
  password: 'admin123'
};

let userToken = null;
let adminToken = null;
let loanId = null;

async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  return { response, data };
}

async function login(user) {
  console.log(`\n🔐 Fazendo login como ${user.email}...`);
  const { response, data } = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(user)
  });
  
  if (response.ok) {
    console.log('✅ Login successful');
    return data.token;
  } else {
    console.error('❌ Login failed:', data);
    throw new Error(`Login failed: ${data.message}`);
  }
}

async function getUserBalance(token) {
  console.log('\n💰 Verificando saldo do usuário...');
  const { response, data } = await makeRequest('/users/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    console.log(`✅ Saldo atual: R$ ${parseFloat(data.user.balance).toFixed(2)}`);
    return parseFloat(data.user.balance);
  } else {
    console.error('❌ Erro ao obter saldo:', data);
    throw new Error(`Failed to get balance: ${data.message}`);
  }
}

async function getAdminDashboard(token) {
  console.log('\n📊 Verificando dashboard administrativo...');
  const { response, data } = await makeRequest('/admin/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    console.log(`✅ Caixa operacional: R$ ${parseFloat(data.data.systemConfig.system_balance).toFixed(2)}`);
    console.log(`✅ Lucro de juros: R$ ${parseFloat(data.data.systemConfig.profit_pool).toFixed(2)}`);
    console.log(`✅ Empréstimos pendentes: ${data.data.pendingLoans.length}`);
    return data.data;
  } else {
    console.error('❌ Erro ao obter dashboard:', data);
    throw new Error(`Failed to get dashboard: ${data.message}`);
  }
}

async function requestLoan(token, amount, installments = 1) {
  console.log(`\n💸 Solicitando empréstimo de R$ ${amount} em ${installments}x...`);
  const { response, data } = await makeRequest('/loans', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      amount,
      installments,
      pixKeyToReceive: 'test-pix@example.com'
    })
  });
  
  if (response.ok) {
    console.log('✅ Empréstimo solicitado com sucesso');
    console.log(`ID do empréstimo: ${data.loan.id}`);
    console.log(`Valor total a pagar: R$ ${parseFloat(data.loan.totalRepayment).toFixed(2)}`);
    return data.loan.id;
  } else {
    console.error('❌ Erro ao solicitar empréstimo:', data);
    throw new Error(`Failed to request loan: ${data.message}`);
  }
}

async function approveLoan(token, loanId) {
  console.log(`\n✅ Aprovando empréstimo ${loanId}...`);
  const { response, data } = await makeRequest('/admin/process-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      id: loanId,
      type: 'LOAN',
      action: 'APPROVE'
    })
  });
  
  if (response.ok) {
    console.log('✅ Empréstimo aprovado com sucesso');
    return true;
  } else {
    console.error('❌ Erro ao aprovar empréstimo:', data);
    throw new Error(`Failed to approve loan: ${data.message}`);
  }
}

async function requestWithdrawal(token, amount, pixKey) {
  console.log(`\n🏧 Solicitando saque de R$ ${amount}...`);
  const { response, data } = await makeRequest('/withdrawals', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      amount,
      pixKey
    })
  });
  
  if (response.ok) {
    console.log('✅ Saque solicitado com sucesso');
    console.log(`ID da transação: ${data.transaction.id}`);
    console.log(`Taxa de saque: R$ ${parseFloat(data.transaction.fee).toFixed(2)}`);
    console.log(`Valor líquido: R$ ${parseFloat(data.transaction.netAmount).toFixed(2)}`);
    return data.transaction.id;
  } else {
    console.error('❌ Erro ao solicitar saque:', data);
    throw new Error(`Failed to request withdrawal: ${data.message}`);
  }
}

async function approveWithdrawal(token, transactionId) {
  console.log(`\n✅ Aprovando saque ${transactionId}...`);
  const { response, data } = await makeRequest('/admin/approve-withdrawal', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      transactionId
    })
  });
  
  if (response.ok) {
    console.log('✅ Saque aprovado com sucesso');
    console.log(`Taxa adicionada ao lucro: R$ ${parseFloat(data.data.feeAmount).toFixed(2)}`);
    console.log(`Valor deduzido do caixa: R$ ${parseFloat(data.data.netAmount).toFixed(2)}`);
    return true;
  } else {
    console.error('❌ Erro ao aprovar saque:', data);
    throw new Error(`Failed to approve withdrawal: ${data.message}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  try {
    console.log('🚀 Iniciando teste do fluxo de aprovação de empréstimo e saque...\n');
    
    // 1. Login como admin
    adminToken = await login(ADMIN_USER);
    
    // 2. Verificar estado inicial do sistema
    console.log('\n=== ESTADO INICIAL DO SISTEMA ===');
    const initialDashboard = await getAdminDashboard(adminToken);
    
    // 3. Login como usuário
    userToken = await login(TEST_USER);
    
    // 4. Verificar saldo inicial do usuário
    console.log('\n=== SALDO INICIAL DO USUÁRIO ===');
    const initialBalance = await getUserBalance(userToken);
    
    // 5. Solicitar empréstimo
    console.log('\n=== SOLICITAÇÃO DE EMPRÉSTIMO ===');
    const loanAmount = 100;
    loanId = await requestLoan(userToken, loanAmount, 3);
    
    // 6. Verificar que o empréstimo está pendente
    console.log('\n=== VERIFICANDO EMPRÉSTIMO PENDENTE ===');
    await sleep(1000); // Aguardar um pouco
    const pendingDashboard = await getAdminDashboard(adminToken);
    const pendingLoan = pendingDashboard.pendingLoans.find(l => l.id == loanId);
    if (pendingLoan) {
      console.log(`✅ Empréstimo ${loanId} encontrado como pendente`);
    } else {
      throw new Error('Empréstimo não encontrado na lista de pendentes');
    }
    
    // 7. Aprovar empréstimo
    console.log('\n=== APROVAÇÃO DE EMPRÉSTIMO ===');
    await approveLoan(adminToken, loanId);
    
    // 8. Verificar saldo após aprovação do empréstimo
    console.log('\n=== SALDO APÓS APROVAÇÃO DO EMPRÉSTIMO ===');
    await sleep(1000); // Aguardar processamento
    const balanceAfterLoan = await getUserBalance(userToken);
    const expectedBalanceAfterLoan = initialBalance + loanAmount;
    
    if (Math.abs(balanceAfterLoan - expectedBalanceAfterLoan) < 0.01) {
      console.log(`✅ Saldo atualizado corretamente: R$ ${balanceAfterLoan.toFixed(2)}`);
    } else {
      console.error(`❌ Saldo incorreto. Esperado: R$ ${expectedBalanceAfterLoan.toFixed(2)}, Atual: R$ ${balanceAfterLoan.toFixed(2)}`);
    }
    
    // 9. Verificar caixa operacional após aprovação
    console.log('\n=== CAIXA OPERACIONAL APÓS APROVAÇÃO ===');
    const dashboardAfterLoan = await getAdminDashboard(adminToken);
    const expectedOperationalCash = parseFloat(initialDashboard.systemConfig.system_balance) - loanAmount;
    const actualOperationalCash = parseFloat(dashboardAfterLoan.systemConfig.system_balance);
    
    if (Math.abs(actualOperationalCash - expectedOperationalCash) < 0.01) {
      console.log(`✅ Caixa operacional atualizado corretamente: R$ ${actualOperationalCash.toFixed(2)}`);
    } else {
      console.error(`❌ Caixa operacional incorreto. Esperado: R$ ${expectedOperationalCash.toFixed(2)}, Atual: R$ ${actualOperationalCash.toFixed(2)}`);
    }
    
    // 10. Solicitar saque
    console.log('\n=== SOLICITAÇÃO DE SAQUE ===');
    const withdrawalAmount = 50;
    const withdrawalId = await requestWithdrawal(userToken, withdrawalAmount, 'saque-teste@example.com');
    
    // 11. Verificar saque pendente
    console.log('\n=== VERIFICANDO SAQUE PENDENTE ===');
    await sleep(1000);
    const dashboardWithPendingWithdrawal = await getAdminDashboard(adminToken);
    const pendingWithdrawal = dashboardWithPendingWithdrawal.pendingTransactions.find(t => t.id == withdrawalId);
    if (pendingWithdrawal) {
      console.log(`✅ Saque ${withdrawalId} encontrado como pendente`);
    } else {
      throw new Error('Saque não encontrado na lista de pendentes');
    }
    
    // 12. Aprovar saque
    console.log('\n=== APROVAÇÃO DE SAQUE ===');
    await approveWithdrawal(adminToken, withdrawalId);
    
    // 13. Verificar saldo final
    console.log('\n=== SALDO FINAL DO USUÁRIO ===');
    await sleep(1000);
    const finalBalance = await getUserBalance(userToken);
    const expectedFinalBalance = balanceAfterLoan - withdrawalAmount;
    
    if (Math.abs(finalBalance - expectedFinalBalance) < 0.01) {
      console.log(`✅ Saldo final correto: R$ ${finalBalance.toFixed(2)}`);
    } else {
      console.error(`❌ Saldo final incorreto. Esperado: R$ ${expectedFinalBalance.toFixed(2)}, Atual: R$ ${finalBalance.toFixed(2)}`);
    }
    
    // 14. Verificar estado final do sistema
    console.log('\n=== ESTADO FINAL DO SISTEMA ===');
    const finalDashboard = await getAdminDashboard(adminToken);
    
    // Calcular valores esperados
    const expectedFee = Math.max(withdrawalAmount * 0.02, 5.00);
    const expectedFinalOperationalCash = actualOperationalCash - (withdrawalAmount - expectedFee);
    const expectedFinalProfit = parseFloat(dashboardAfterLoan.systemConfig.profit_pool) + expectedFee;
    
    console.log('\n📋 RESUMO DO TESTE:');
    console.log(`• Saldo inicial: R$ ${initialBalance.toFixed(2)}`);
    console.log(`• Empréstimo aprovado: +R$ ${loanAmount.toFixed(2)}`);
    console.log(`• Saque aprovado: -R$ ${withdrawalAmount.toFixed(2)}`);
    console.log(`• Saldo final: R$ ${finalBalance.toFixed(2)}`);
    console.log(`• Taxa de saque: R$ ${expectedFee.toFixed(2)}`);
    console.log(`• Caixa operacional final: R$ ${parseFloat(finalDashboard.systemConfig.system_balance).toFixed(2)}`);
    console.log(`• Lucro de juros final: R$ ${parseFloat(finalDashboard.systemConfig.profit_pool).toFixed(2)}`);
    
    // Verificar se tudo está correto
    const operationalCashCorrect = Math.abs(parseFloat(finalDashboard.systemConfig.system_balance) - expectedFinalOperationalCash) < 0.01;
    const profitCorrect = Math.abs(parseFloat(finalDashboard.systemConfig.profit_pool) - expectedFinalProfit) < 0.01;
    
    if (operationalCashCorrect && profitCorrect) {
      console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
      console.log('✅ Valores do sistema atualizados corretamente');
      console.log('✅ Fluxo de aprovação de empréstimo e saque funcionando perfeitamente');
    } else {
      console.log('\n❌ TESTE FALHOU!');
      if (!operationalCashCorrect) {
        console.error(`❌ Caixa operacional incorreto. Esperado: R$ ${expectedFinalOperationalCash.toFixed(2)}, Atual: R$ ${parseFloat(finalDashboard.systemConfig.system_balance).toFixed(2)}`);
      }
      if (!profitCorrect) {
        console.error(`❌ Lucro de juros incorreto. Esperado: R$ ${expectedFinalProfit.toFixed(2)}, Atual: R$ ${parseFloat(finalDashboard.systemConfig.profit_pool).toFixed(2)}`);
      }
    }
    
  } catch (error) {
    console.error('\n💥 ERRO DURANTE O TESTE:', error.message);
    process.exit(1);
  }
}

// Executar teste
runTest();