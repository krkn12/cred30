// Teste completo da funcionalidade de primeiro usuário como administrador
// Este teste simula um ambiente limpo (sem admin hardcoded)
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testFirstUserClean() {
  console.log('🧪 Teste completo: Primeiro usuário como administrador');
  console.log('📝 Simulando ambiente limpo (sem admin hardcoded)\n');
  
  try {
    // 1. Criar primeiro usuário - deve se tornar admin
    console.log('📋 Passo 1: Criando primeiro usuário (deve ser admin)...');
    
    const firstUserResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Administrador Principal',
        email: 'admin@principal.com',
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
        
        // 2. Testar acesso à dashboard administrativa
        console.log('📋 Passo 2: Testando acesso à dashboard administrativa...');
        
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
        } else {
          console.log('❌ Acesso negado:', dashboardResponse.status);
          const errorData = await dashboardResponse.json();
          console.log('Erro:', errorData.message);
        }
        
        // 3. Criar segundo usuário - não deve ser admin
        console.log('📋 Passo 3: Criando segundo usuário (não deve ser admin)...');
        
        const secondUserResponse = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Usuário Comum',
            email: 'usuario@comum.com',
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
          console.log('💬 Mensagem:', secondUserResult.message);
          
          if (!secondUserResult.data.user.isAdmin) {
            console.log('✅ CORRETO: Segundo usuário não é administrador!\n');
            
            // 4. Tentar acesso admin com segundo usuário - deve falhar
            console.log('📋 Passo 4: Testando acesso negado para segundo usuário...');
            
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
testFirstUserClean().then(() => {
  console.log('\n🏁 Teste finalizado!');
}).catch(error => {
  console.error('❌ Erro no teste:', error);
});