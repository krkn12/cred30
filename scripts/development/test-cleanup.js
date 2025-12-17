// Script para limpar o banco de dados e testar do zero
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

async function testCleanSetup() {
  console.log('=== TESTE COM SETUP LIMPO ===\n');
  
  try {
    // 1. Criar primeiro usuário (deve ser admin)
    console.log('1. Criando primeiro usuário (deve ser admin)...');
    const timestamp = Date.now();
    const registerResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Administrador',
        email: `admin${timestamp}@example.com`,
        password: '123456',
        secretPhrase: 'admin123',
        pixKey: 'admin@pix.com'
      })
    });
    
    const adminToken = registerResponse.data.token;
    const adminId = registerResponse.data.user.id;
    const isAdmin = registerResponse.data.user.isAdmin;
    
    console.log('✓ Primeiro usuário criado');
    console.log(`   ID: ${adminId}`);
    console.log(`   Email: admin${timestamp}@example.com`);
    console.log(`   É admin: ${isAdmin}`);
    
    // 2. Verificar acesso admin
    console.log('\n2. Verificando acesso administrativo...');
    try {
      const adminStats = await apiRequest('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      console.log('✓ Acesso admin confirmado!');
      console.log('   Stats:', JSON.stringify(adminStats.data, null, 2));
    } catch (error) {
      console.log('❌ Falha no acesso admin:', error.message);
      return;
    }
    
    // 3. Criar usuário normal
    console.log('\n3. Criando usuário normal...');
    const userResponse = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Usuário Normal',
        email: `user${timestamp}@example.com`,
        password: '123456',
        secretPhrase: 'user123',
        pixKey: 'user@pix.com'
      })
    });
    
    const userToken = userResponse.data.token;
    const userId = userResponse.data.user.id;
    const userIsAdmin = userResponse.data.user.isAdmin;
    
    console.log('✓ Usuário normal criado');
    console.log(`   ID: ${userId}`);
    console.log(`   É admin: ${userIsAdmin}`);
    
    // 4. Verificar que usuário normal não tem acesso admin
    console.log('\n4. Verificando que usuário normal não tem acesso admin...');
    try {
      await apiRequest('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      console.log('❌ Usuário normal não deveria ter acesso admin!');
    } catch (error) {
      console.log('✓ Usuário normal corretamente bloqueado:', error.message);
    }
    
    // 5. Solicitar empréstimo como usuário normal
    console.log('\n5. Solicitando empréstimo como usuário normal...');
    const loanResponse = await apiRequest('/loans/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        amount: 50,
        installments: 1,
        receivePixKey: 'user@pix.com'
      })
    });
    
    const loanId = loanResponse.data.loanId;
    console.log('✓ Empréstimo solicitado');
    console.log(`   ID: ${loanId}`);
    
    // 6. Verificar saldo inicial
    console.log('\n6. Verificando saldo inicial...');
    const balanceResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const initialBalance = balanceResponse.data.balance;
    console.log(`✓ Saldo inicial: R$ ${initialBalance.toFixed(2)}`);
    
    // 7. Aprovar empréstimo como admin
    console.log('\n7. Aprovando empréstimo como admin...');
    try {
      await apiRequest('/admin/process-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id: loanId,
          type: 'LOAN',
          action: 'APPROVE'
        })
      });
      console.log('✓ Empréstimo aprovado com sucesso!');
    } catch (error) {
      console.log('❌ Falha ao aprovar empréstimo:', error.message);
      return;
    }
    
    // 8. Aguardar processamento
    console.log('\n8. Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 9. Verificar saldo final
    console.log('\n9. Verificando saldo final...');
    const finalBalanceResponse = await apiRequest('/users/balance', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    const finalBalance = finalBalanceResponse.data.balance;
    console.log(`✓ Saldo final: R$ ${finalBalance.toFixed(2)}`);
    
    // 10. Análise final
    console.log('\n10. ANÁLISE FINAL:');
    console.log(`   Saldo inicial:     R$ ${initialBalance.toFixed(2)}`);
    console.log(`   Valor empréstimo:  R$ 50.00`);
    console.log(`   Saldo esperado:    R$ ${(initialBalance + 50).toFixed(2)}`);
    console.log(`   Saldo atual:       R$ ${finalBalance.toFixed(2)}`);
    
    const diferenca = finalBalance - (initialBalance + 50);
    if (Math.abs(diferenca) < 0.01) {
      console.log('\n✅ SUCESSO: O saldo foi atualizado corretamente!');
    } else {
      console.log('\n❌ FALHA: O saldo não foi atualizado corretamente!');
      console.log(`   Diferença: R$ ${diferenca.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

testCleanSetup();