// Script para verificar o estado do banco e testar a funcionalidade
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function checkDatabaseAndTest() {
  console.log('🔍 Verificando estado atual do banco de dados...\n');
  
  try {
    // 1. Tentar fazer login com admin hardcoded para ver se ainda funciona
    console.log('📋 Passo 1: Verificando se admin hardcoded ainda funciona...');
    
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
      console.log('✅ Admin hardcoded ainda está ativo!');
      console.log('⚠️  Este é o problema: o admin hardcoded impede que novos usuários se tornem admin.');
      console.log('💡 Solução: precisamos desabilitar o admin hardcoded ou limpar o banco completamente.');
      
      // 2. Verificar se existem usuários admin no banco
      console.log('\n📋 Passo 2: Verificando administradores no banco...');
      
      const adminToken = (await adminLoginResponse.json()).data.token;
      
      // Tentar acessar dashboard para ver se funciona
      const dashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (dashboardResponse.ok) {
        console.log('✅ Dashboard administrativa acessível com admin hardcoded');
      }
      
      console.log('\n🔧 Para testar a nova funcionalidade, precisamos:');
      console.log('   1. Desabilitar temporariamente o admin hardcoded');
      console.log('   2. Ou limpar completamente o banco de dados');
      console.log('   3. Ou usar um ambiente de teste isolado');
      
    } else {
      console.log('❌ Admin hardcoded não está funcionando');
      console.log('🤔 Isso é estranho, deveria estar funcionando...');
    }
    
    // 3. Tentar criar um novo usuário mesmo assim
    console.log('\n📋 Passo 3: Tentando criar novo usuário...');
    
    const timestamp = Date.now();
    const email = `user${timestamp}@teste.com`;
    
    const newUserResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Usuário Teste',
        email: email,
        password: 'senha123',
        secretPhrase: 'teste123',
        pixKey: '12345678901'
      })
    });
    
    if (newUserResponse.ok) {
      const newUserResult = await newUserResponse.json();
      console.log('✅ Usuário criado!');
      console.log('📧 Email:', newUserResult.data.user.email);
      console.log('🔑 É administrador?', newUserResult.data.user.isAdmin);
      console.log('💬 Mensagem:', newUserResult.message);
      
      if (newUserResult.data.user.isAdmin) {
        console.log('🎉 SUCESSO: Funcionalidade está funcionando!');
      } else {
        console.log('❌ Usuário não se tornou administrador');
        console.log('🔍 Provavelmente devido ao admin hardcoded ainda estar ativo');
      }
    } else {
      console.log('❌ Erro ao criar usuário:', newUserResponse.status);
      const errorData = await newUserResponse.json();
      console.log('Erro:', errorData.message);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a verificação:', error.message);
  }
}

// Executar verificação
checkDatabaseAndTest().then(() => {
  console.log('\n🏁 Verificação concluída!');
}).catch(error => {
  console.error('❌ Erro na verificação:', error);
});