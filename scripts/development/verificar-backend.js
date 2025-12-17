// Script simples para verificar se o backend está online
const API_BASE_URL = 'http://localhost:3001/api';

async function verificarBackend() {
  console.log('Verificando se o backend está online...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend está online!');
      console.log('Resposta:', data);
    } else {
      console.log(`❌ Backend retornou status: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Backend não está respondendo');
    console.log('Erro:', error.message);
    console.log('');
    console.log('Possíveis causas:');
    console.log('1. O backend não está rodando');
    console.log('2. A porta 3001 está sendo usada por outro serviço');
    console.log('3. O CORS está bloqueando a requisição');
    console.log('');
    console.log('Soluções:');
    console.log('1. Inicie o backend: cd backend && npm run dev');
    console.log('2. Verifique se não há nada rodando na porta 3001');
    console.log('3. Verifique o console do backend para erros');
  }
}

verificarBackend();