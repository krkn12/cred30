// Teste para verificar o fluxo de empréstimo com PIX
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testLoanPix() {
  console.log('=== TESTE DE EMPRÉSTIMO COM PIX ===');
  
  try {
    // 1. Fazer login como usuário normal
    console.log('\n1. Fazendo login como usuário...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'milene@gmail.com',
        password: '32588589',
        secretPhrase: '32588589'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
      throw new Error('Login falhou: ' + loginData.message);
    }
    
    const token = loginData.data.token;
    console.log('Token obtido:', token.substring(0, 20) + '...');
    
    // 2. Solicitar empréstimo com PIX
    console.log('\n2. Solicitando empréstimo com PIX...');
    const loanData = {
      amount: 100,
      installments: 2,
      receivePixKey: '12345678901' // CPF de teste
    };
    
    console.log('Dados do empréstimo:', loanData);
    
    const loanResponse = await fetch(`${API_BASE}/loans/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(loanData)
    });
    
    const loanResult = await loanResponse.json();
    console.log('Resposta da solicitação de empréstimo:', JSON.stringify(loanResult, null, 2));
    
    if (loanResult.success) {
      console.log('\n✅ Empréstimo solicitado com sucesso!');
      console.log('ID do empréstimo:', loanResult.data.loanId);
      console.log('Total a pagar:', loanResult.data.totalRepayment);
    } else {
      console.log('\n❌ Erro na solicitação de empréstimo:', loanResult.message);
    }
    
    // 3. Verificar empréstimos pendentes como admin
    console.log('\n3. Verificando empréstimos pendentes como admin...');
    
    // Login como admin
    const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'josiassm701@gmail.com',
        password: '32588589',
        secretPhrase: 'kaka'
      })
    });
    
    const adminLoginData = await adminLoginResponse.json();
    const adminToken = adminLoginData.data.token;
    
    const dashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const dashboardData = await dashboardResponse.json();
    console.log('Dados do dashboard admin:', JSON.stringify(dashboardData, null, 2));
    
    // Verificar empréstimos pendentes
    const pendingLoans = dashboardData.data?.pendingLoans || dashboardData.pendingLoans || [];
    console.log('\n4. Empréstimos pendentes encontrados:');
    
    if (pendingLoans.length > 0) {
      pendingLoans.forEach((loan, index) => {
        console.log(`\nEmpréstimo ${index + 1}:`);
        console.log('  ID:', loan.id);
        console.log('  Valor:', loan.amount);
        console.log('  PIX:', loan.pix_key_to_receive || loan.pixKeyToReceive || 'NÃO INFORMADO');
        console.log('  Status:', loan.status);
        console.log('  Usuário:', loan.user_name || loan.userName);
        console.log('  Email:', loan.user_email || loan.userEmail);
      });
    } else {
      console.log('Nenhum empréstimo pendente encontrado.');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
  }
}

// Executar teste
testLoanPix();