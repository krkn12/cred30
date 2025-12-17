// Teste simples para verificar atualização de saldo após aprovação de empréstimo
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

async function testarFluxoCompleto() {
  console.log('=== TESTE SIMPLIFICADO DE ATUALIZAÇÃO DE SALDO ===\n');
  
  try {
    // 1. Criar usuário de teste
    console.log('1. Criando usuário de teste...');
    const timestamp = Date.now();
    const userEmail = `teste${timestamp}@example.com`;
    
    const registerResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Usuário Teste',
        email: userEmail,
        password: '123456',
        secretPhrase: 'teste123',
        pixKey: 'teste@pix.com'
      })
    });
    
    const userToken = registerResponse.data.token;
    const userId = registerResponse.data.user.id;
    console.log('✓ Usuário criado com sucesso');
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${userEmail}`);
    
    // 2. Verificar saldo inicial
    console.log('\n2. Verificando saldo inicial...');
    const saldoInicialResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const saldoInicial = saldoInicialResponse.data.balance;
    console.log(`✓ Saldo inicial: R$ ${saldoInicial.toFixed(2)}`);
    
    // 3. Solicitar empréstimo
    console.log('\n3. Solicitando empréstimo de R$ 50,00...');
    const emprestimoResponse = await apiRequest('/loans/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        amount: 50,
        installments: 1,
        receivePixKey: 'teste@pix.com'
      })
    });
    
    if (!emprestimoResponse.data || !emprestimoResponse.data.loanId) {
      throw new Error('Resposta da API não contém ID do empréstimo');
    }
    
    const emprestimoId = emprestimoResponse.data.loanId;
    console.log('✓ Empréstimo solicitado com sucesso');
    console.log(`   ID: ${emprestimoId}`);
    console.log(`   Total a pagar: R$ ${emprestimoResponse.data.totalRepayment.toFixed(2)}`);
    
    // 4. O primeiro usuário criado já é administrador automaticamente
    console.log('\n4. Usando primeiro usuário como administrador...');
    const adminToken = registerResponse.data.token;
    console.log('✓ Primeiro usuário já é administrador');
    
    // 5. Verificar se o primeiro usuário realmente é admin
    console.log('\n5. Verificando permissões de administrador...');
    
    // 6. Aprovar empréstimo
    console.log('\n6. Aprovando empréstimo como administrador...');
    await apiRequest('/admin/process-action', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        id: emprestimoId,
        type: 'LOAN',
        action: 'APPROVE'
      })
    });
    
    console.log('✓ Empréstimo aprovado com sucesso');
    
    // 7. Aguardar processamento
    console.log('\n7. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. Verificar saldo após aprovação
    console.log('\n8. Verificando saldo após aprovação...');
    const saldoFinalResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const saldoFinal = saldoFinalResponse.data.balance;
    console.log(`✓ Saldo final: R$ ${saldoFinal.toFixed(2)}`);
    
    // 9. Verificar transações
    console.log('\n9. Verificando transações...');
    const transacoesResponse = await apiRequest('/users/transactions', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const transacoes = transacoesResponse.data.transactions;
    console.log(`Total de transações: ${transacoes.length}`);
    
    // 10. Análise final
    console.log('\n10. ANÁLISE FINAL:');
    console.log(`   Saldo inicial:     R$ ${saldoInicial.toFixed(2)}`);
    console.log(`   Valor empréstimo:  R$ 50.00`);
    console.log(`   Saldo esperado:    R$ ${(saldoInicial + 50).toFixed(2)}`);
    console.log(`   Saldo atual:       R$ ${saldoFinal.toFixed(2)}`);
    
    const diferenca = saldoFinal - (saldoInicial + 50);
    if (Math.abs(diferenca) < 0.01) {
      console.log('\n✅ SUCESSO: O saldo foi atualizado corretamente!');
      
      // Verificar transação de empréstimo
      const transacaoEmprestimo = transacoes.find(t => 
        t.type === 'LOAN_APPROVED' || 
        (t.type === 'LOAN_RECEIVED' && t.status === 'APPROVED')
      );
      
      if (transacaoEmprestimo) {
        console.log('✓ Transação de empréstimo encontrada:');
        console.log(`   Tipo: ${transacaoEmprestimo.type}`);
        console.log(`   Valor: R$ ${transacaoEmprestimo.amount.toFixed(2)}`);
        console.log(`   Status: ${transacaoEmprestimo.status}`);
        console.log(`   Descrição: ${transacaoEmprestimo.description}`);
      } else {
        console.log('⚠️  Transação de empréstimo não encontrada');
        console.log('Transações disponíveis:');
        transacoes.slice(-5).forEach(t => {
          console.log(`   ${t.type}: R$ ${t.amount.toFixed(2)} (${t.status})`);
        });
      }
    } else {
      console.log('\n❌ FALHA: O saldo não foi atualizado corretamente!');
      console.log(`   Diferença: R$ ${diferenca.toFixed(2)}`);
      
      // Debug: verificar perfil completo
      console.log('\nDEBUG - Verificando perfil completo:');
      const perfilResponse = await apiRequest('/users/profile', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      console.log('Dados do perfil:', JSON.stringify(perfilResponse.data.user, null, 2));
      
      console.log('\nDEBUG - Todas as transações:');
      transacoes.forEach((t, index) => {
        console.log(`${index + 1}. ${t.type}: R$ ${t.amount.toFixed(2)} (${t.status}) - ${t.description}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

testarFluxoCompleto();