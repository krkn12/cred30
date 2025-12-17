// Teste para verificar se o primeiro usuário se torna administrador
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testFirstUserAdmin() {
  console.log('🧪 Testando funcionalidade de primeiro usuário como administrador...\n');
  
  try {
    // 1. Limpar usuários existentes para garantir que o primeiro usuário seja o admin
    console.log('📋 Passo 1: Verificando se já existem administradores...');
    
    const checkResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Teste Admin',
        email: 'admin@teste.com',
        password: '123456',
        secretPhrase: 'admin123',
        pixKey: '12345678901'
      })
    });
    
    const checkResult = await checkResponse.json();
    
    if (checkResponse.ok) {
      console.log('✅ Primeiro usuário criado com sucesso!');
      console.log('📧 Email:', checkResult.data.user.email);
      console.log('👤 Nome:', checkResult.data.user.name);
      console.log('🔑 É administrador?', checkResult.data.user.isAdmin);
      console.log('💬 Mensagem:', checkResult.message);
      console.log('🎫 Token:', checkResult.data.token.substring(0, 50) + '...');
      
      // 2. Testar acesso à rota administrativa
      console.log('\n📋 Passo 2: Testando acesso à rota administrativa...');
      
      const dashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${checkResult.data.token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (dashboardResponse.ok) {
        console.log('✅ Acesso à dashboard administrativa concedido!');
        const dashboardData = await dashboardResponse.json();
        console.log('📊 Dashboard carregado com sucesso!');
      } else {
        console.log('❌ Acesso à dashboard administrativa negado!');
        console.log('Status:', dashboardResponse.status);
        const errorData = await dashboardResponse.json();
        console.log('Erro:', errorData.message);
      }
      
      // 3. Criar segundo usuário para verificar que não se torna admin
      console.log('\n📋 Passo 3: Criando segundo usuário (não deve ser admin)...');
      
      const secondUserResponse = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Usuário Comum',
          email: 'comum@teste.com',
          password: '123456',
          secretPhrase: 'comum123',
          pixKey: '98765432109'
        })
      });
      
      if (secondUserResponse.ok) {
        const secondUserResult = await secondUserResponse.json();
        console.log('✅ Segundo usuário criado com sucesso!');
        console.log('📧 Email:', secondUserResult.data.user.email);
        console.log('👤 Nome:', secondUserResult.data.user.name);
        console.log('🔑 É administrador?', secondUserResult.data.user.isAdmin);
        console.log('💬 Mensagem:', secondUserResult.message);
        
        // 4. Tentar acessar rota admin com segundo usuário
        console.log('\n📋 Passo 4: Testando acesso do segundo usuário à rota administrativa...');
        
        const secondUserDashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secondUserResult.data.token}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (secondUserDashboardResponse.status === 403) {
          console.log('✅ Acesso negado corretamente para segundo usuário!');
        } else {
          console.log('❌ Segundo usuário não deveria ter acesso à dashboard!');
          console.log('Status:', secondUserDashboardResponse.status);
        }
      } else {
        console.log('❌ Erro ao criar segundo usuário!');
        const errorData = await secondUserResponse.json();
        console.log('Erro:', errorData.message);
      }
      
    } else {
      console.log('❌ Erro ao criar primeiro usuário!');
      console.log('Status:', checkResponse.status);
      console.log('Erro:', checkResult.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testFirstUserAdmin().then(() => {
  console.log('\n🎉 Teste concluído!');
}).catch(error => {
  console.error('❌ Erro no teste:', error);
});