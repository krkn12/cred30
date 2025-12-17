// Script para limpar usuários existentes e testar funcionalidade de primeiro admin
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function cleanAndTestAdmin() {
  console.log('🧹 Limpando usuários existentes e testando funcionalidade...\n');
  
  try {
    // 1. Limpar todos os usuários (exceto o admin hardcoded)
    console.log('📋 Passo 1: Limpando banco de dados...');
    
    // Para este teste, vamos assumir que precisamos limpar o banco
    // Em um ambiente real, você faria isso diretamente no banco de dados
    
    // 2. Criar primeiro usuário (deve se tornar admin)
    console.log('\n📋 Passo 2: Criando primeiro usuário (deve ser admin)...');
    
    const firstUserResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Primeiro Admin',
        email: 'primeiro@admin.com',
        password: '123456',
        secretPhrase: 'primeiro123',
        pixKey: '11111111111'
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
        console.log('🎉 SUCESSO: Primeiro usuário foi definido como administrador!');
        
        // 3. Testar acesso à dashboard
        console.log('\n📋 Passo 3: Testando acesso à dashboard administrativa...');
        
        const dashboardResponse = await fetch(`${API_BASE}/admin/dashboard`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${firstUserResult.data.token}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (dashboardResponse.ok) {
          console.log('✅ Acesso à dashboard concedido!');
          const dashboardData = await dashboardResponse.json();
          console.log('📊 Dashboard carregado com sucesso!');
        } else {
          console.log('❌ Acesso negado:', dashboardResponse.status);
        }
      } else {
        console.log('❌ PROBLEMA: Primeiro usuário não foi definido como administrador!');
        console.log('🔍 Verificando se já existe admin no sistema...');
        
        // Tentar fazer login com o admin hardcoded para verificar
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
          console.log('⚠️  O sistema ainda está usando o admin hardcoded!');
          console.log('📝 Isso explica por que o novo usuário não se tornou admin.');
          console.log('💡 Para testar a nova funcionalidade, precisamos garantir que não existam admins.');
        }
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
cleanAndTestAdmin().then(() => {
  console.log('\n🎉 Teste concluído!');
}).catch(error => {
  console.error('❌ Erro no teste:', error);
});