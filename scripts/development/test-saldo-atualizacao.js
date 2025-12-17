// Teste para verificar se o saldo do usuário é atualizado após aprovação de empréstimo
const API_BASE_URL = 'http://localhost:3001/api';

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Função principal de teste
async function testarAtualizacaoSaldo() {
  console.log('=== TESTE DE ATUALIZAÇÃO DE SALDO APÓS APROVAÇÃO DE EMPRÉSTIMO ===\n');
  
  try {
    // 1. Login como administrador
    console.log('1. Fazendo login como administrador...');
    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'josiassm701@gmail.com',
        password: '123456',
        secretPhrase: 'admin123'
      })
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✓ Login administrativo realizado com sucesso');
    
    // 2. Login como cliente
    console.log('\n2. Fazendo login como cliente...');
    const clientLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'cliente@teste.com',
        password: '123456',
        secretPhrase: 'cliente123'
      })
    });
    
    const clientToken = clientLogin.data.token;
    const userId = clientLogin.data.user.id;
    console.log('✓ Login cliente realizado com sucesso');
    console.log(`   ID do usuário: ${userId}`);
    
    // 3. Verificar saldo inicial do cliente
    console.log('\n3. Verificando saldo inicial do cliente...');
    const saldoInicialResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${clientToken}`
      }
    });
    
    const saldoInicial = saldoInicialResponse.data.balance;
    console.log(`✓ Saldo inicial: R$ ${saldoInicial.toFixed(2)}`);
    
    // 4. Solicitar empréstimo
    console.log('\n4. Solicitando empréstimo de R$ 100,00...');
    const emprestimoResponse = await apiRequest('/loans/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        amount: 100,
        installments: 1,
        receivePixKey: 'teste@pix.com'
      })
    });
    
    console.log('✓ Empréstimo solicitado com sucesso');
    const emprestimoId = emprestimoResponse.data.loan.id;
    console.log(`   ID do empréstimo: ${emprestimoId}`);
    
    // 5. Verificar saldo após solicitação (não deve mudar)
    console.log('\n5. Verificando saldo após solicitação...');
    const saldoAposSolicitacaoResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${clientToken}`
      }
    });
    
    const saldoAposSolicitacao = saldoAposSolicitacaoResponse.data.balance;
    console.log(`✓ Saldo após solicitação: R$ ${saldoAposSolicitacao.toFixed(2)}`);
    
    if (saldoAposSolicitacao !== saldoInicial) {
      console.log('⚠️  AVISO: Saldo mudou após solicitação (não deveria mudar)');
    } else {
      console.log('✓ Saldo permaneceu o mesmo após solicitação (correto)');
    }
    
    // 6. Aprovar empréstimo como administrador
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
    
    // 7. Aguardar um pouco para processamento
    console.log('\n7. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. Verificar saldo após aprovação
    console.log('\n8. Verificando saldo após aprovação...');
    const saldoAposAprovacaoResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${clientToken}`
      }
    });
    
    const saldoAposAprovacao = saldoAposAprovacaoResponse.data.balance;
    console.log(`✓ Saldo após aprovação: R$ ${saldoAposAprovacao.toFixed(2)}`);
    
    // 9. Verificar se o saldo foi atualizado corretamente
    const saldoEsperado = saldoInicial + 100; // Saldo inicial + valor do empréstimo
    
    console.log('\n9. Análise dos resultados:');
    console.log(`   Saldo inicial:     R$ ${saldoInicial.toFixed(2)}`);
    console.log(`   Valor empréstimo:  R$ 100.00`);
    console.log(`   Saldo esperado:    R$ ${saldoEsperado.toFixed(2)}`);
    console.log(`   Saldo atual:       R$ ${saldoAposAprovacao.toFixed(2)}`);
    
    if (saldoAposAprovacao === saldoEsperado) {
      console.log('\n✅ SUCESSO: O saldo foi atualizado corretamente após a aprovação do empréstimo!');
    } else {
      console.log('\n❌ FALHA: O saldo não foi atualizado corretamente!');
      console.log(`   Diferença: R$ ${(saldoEsperado - saldoAposAprovacao).toFixed(2)}`);
      
      // 10. Verificar perfil completo do usuário para debug
      console.log('\n10. Verificando perfil completo para debug...');
      const perfilResponse = await apiRequest('/users/profile', {
        headers: {
          'Authorization': `Bearer ${clientToken}`
        }
      });
      
      console.log('Dados completos do usuário:', JSON.stringify(perfilResponse.data.user, null, 2));
    }
    
    // 11. Verificar transações do usuário
    console.log('\n11. Verificando transações do usuário...');
    const transacoesResponse = await apiRequest('/users/transactions', {
      headers: {
        'Authorization': `Bearer ${clientToken}`
      }
    });
    
    const transacoes = transacoesResponse.data.transactions;
    console.log(`Total de transações: ${transacoes.length}`);
    
    // Procurar transação de empréstimo aprovado
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
      console.log(`   Metadata:`, transacaoEmprestimo.metadata);
    } else {
      console.log('❌ Transação de empréstimo não encontrada');
      console.log('Transações disponíveis:', transacoes.map(t => ({ type: t.type, amount: t.amount, status: t.status })));
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.message.includes('401')) {
      console.error('Erro de autenticação. Verifique se os usuários existem e as credenciais estão corretas.');
    }
  }
}

// Executar o teste
testarAtualizacaoSaldo();