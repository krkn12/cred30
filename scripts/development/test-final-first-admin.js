// Teste final da funcionalidade de primeiro usuário como administrador (sem admin hardcoded)
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testFinalFirstAdmin() {
  console.log('🧪 Teste Final: Primeiro usuário como administrador (sem admin hardcoded)');
  console.log('📝 Verificando se o sistema agora funciona corretamente\n');
  
  try {
    // 1. Verificar se admin hardcoded foi removido
    console.log('📋 Passo 1: Verificando se admin hardcoded foi removido...');
    
    const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@cred30.com',
        password: 'admin123',
        secretPhrase: 'admin'
      })
    });
    
    if (adminLoginResponse.ok) {
      console.log('❌ Admin hardcoded ainda está ativo!');
      console.log('🔧 O servidor precisa ser reiniciado para aplicar as alterações.');
      return;
    } else {
      console.log('✅ Admin hardcoded foi removido com sucesso!');
    }
    
    // 2. Criar primeiro usuário - deve se tornar admin
    console.log('\n📋 Passo 2: Criando primeiro usuário (deve ser admin)...');
    
    const timestamp = Date.now();
    const email = `admin${timestamp}@teste.com`;
    
    const firstUserResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Primeiro Administrador',
        email: email,
        password: 'senha123',
        secretPhrase: 'admin123',
        pixKey: '12345678901'
      })
    });
    
    if (firstUserResponse.ok) {
      const firstUserResult = await firstUserResponse.json();
      console.log('✅ Primeiro usuário criado!');
      console.log('📧 Email:', firstUserResult.data.user.email);
      console.log('👤 Nome:', firstUserResult.data.user.name);
      console.log('🔑 É administrador?', firstUserResult.data.user.isAdmin);
      console.log('💬 Mensagem:', firstUserResult.message);
      
      if (firstUserResult.data.user.isAdmin) {
        console.log('🎉 SUCESSO: Primeiro usuário foi definido como administrador!\n');
        
        // 3. Testar acesso à dashboard administrativa
        console.log('📋 Passo 3: Testando acesso à dashboard administrativa...');
        
        const dashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${firstUserResult.data.token}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (dashboardResponse.ok) {
          console.log('✅ Acesso à dashboard concedido com sucesso!');
          console.log('📊 Dashboard administrativo funcional!\n');
          
          // 4. Criar segundo usuário - não deve ser admin
          console.log('📋 Passo 4: Criando segundo usuário (não deve ser admin)...');
          
          const secondTimestamp = Date.now() + 1;
          const secondEmail = `user${secondTimestamp}@teste.com`;
          
          const secondUserResponse = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'Usuário Comum',
              email: secondEmail,
              password: 'senha123',
              secretPhrase: 'comum123',
              pixKey: '98765432109'
            })
          });
          
          if (secondUserResponse.ok) {
            const secondUserResult = await secondUserResponse.json();
            console.log('✅ Segundo usuário criado!');
            console.log('📧 Email:', secondUserResult.data.user.email);
            console.log('👤 Nome:', secondUserResult.data.user.name);
            console.log('🔑 É administrador?', secondUserResult.data.user.isAdmin);
            
            if (!secondUserResult.data.user.isAdmin) {
              console.log('✅ CORRETO: Segundo usuário não é administrador!\n');
              
              // 5. Tentar acesso admin com segundo usuário - deve falhar
              console.log('📋 Passo 5: Testando acesso negado para segundo usuário...');
              
              const secondUserDashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${secondUserResult.data.token}`,
                  'Content-Type': 'application/json',
                }
              });
              
              if (secondUserDashboardResponse.status === 403) {
                console.log('✅ Acesso negado corretamente para usuário comum!');
                console.log('🛡️  Sistema de permissões funcionando corretamente!\n');
                
                console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
                console.log('✅ Funcionalidade de primeiro usuário como administrador está funcionando perfeitamente.');
                console.log('📋 Resumo:');
                console.log('   - Admin hardcoded removido');
                console.log('   - Primeiro usuário cadastrado se tornou administrador automaticamente');
                console.log('   - Acesso à dashboard administrativa concedido para o primeiro usuário');
                console.log('   - Segundo usuário não se tornou administrador');
                console.log('   - Acesso negado corretamente para usuário comum');
                console.log('   - Sistema funcionando conforme solicitado');
              } else {
                console.log('❌ ERRO: Segundo usuário não deveria ter acesso à dashboard!');
                console.log('Status:', secondUserDashboardResponse.status);
              }
            } else {
              console.log('❌ ERRO: Segundo usuário foi definido como administrador incorretamente!');
            }
          } else {
            console.log('❌ Erro ao criar segundo usuário!');
            const errorData = await secondUserResponse.json();
            console.log('Erro:', errorData.message);
          }
        } else {
          console.log('❌ Acesso negado:', dashboardResponse.status);
          const errorData = await dashboardResponse.json();
          console.log('Erro:', errorData.message);
        }
      } else {
        console.log('❌ PROBLEMA: Primeiro usuário não foi definido como administrador!');
        console.log('🔍 Verificando logs do servidor para mais detalhes...');
      }
    } else {
      console.log('❌ Erro ao criar primeiro usuário!');
      const errorData = await firstUserResponse.json();
      console.log('Erro:', errorData.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
testFinalFirstAdmin().then(() => {
  console.log('\n🏁 Teste finalizado!');
}).catch(error => {
  console.error('❌ Erro no teste:', error);
});