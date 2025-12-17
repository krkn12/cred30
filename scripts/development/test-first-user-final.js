// Teste final da funcionalidade de primeiro usuário como administrador
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testFirstUserFinal() {
  console.log('🧪 Teste Final: Primeiro usuário como administrador');
  console.log('📝 Usando email único para garantir teste limpo\n');
  
  try {
    // 1. Criar primeiro usuário - deve se tornar admin
    console.log('📋 Passo 1: Criando primeiro usuário (deve ser admin)...');
    
    const timestamp = Date.now();
    const email = `admin${timestamp}@teste.com`;
    
    const firstUserResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Administrador Principal',
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
          
          console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
          console.log('✅ Funcionalidade de primeiro usuário como administrador está funcionando perfeitamente.');
          console.log('📋 Resumo:');
          console.log('   - Primeiro usuário cadastrado se tornou administrador automaticamente');
          console.log('   - Acesso à dashboard administrativa concedido');
          console.log('   - Sistema funcionando conforme esperado');
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
testFirstUserFinal().then(() => {
  console.log('\n🏁 Teste finalizado!');
}).catch(error => {
  console.error('❌ Erro no teste:', error);
});