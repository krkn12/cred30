a// Script para testar a correção do erro 400 Bad Request no process-action

const API_BASE_URL = 'http://localhost:3001/api';

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Resposta:', data);
    
    if (!response.ok) {
      throw new Error(data.message || 'Erro na requisição');
    }

    return data;
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

// Teste de login admin (usando token fixo para testar process-action)
async function loginAdmin() {
  console.log('=== Usando token fixo para teste ===');
  // Token JWT fixo para testes (vamos assumir que temos um token válido)
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiam9zaWFzc203MDFAZ21haWwuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNjM0NTY3ODkwLCJleHAiOjE2MzQ2NTQyOTB9.test';
}

// Teste de process-action
async function testProcessAction(token) {
  console.log('\n=== Testando process-action ===');
  
  // Teste com ID válido (simulando)
  const testCases = [
    {
      id: '1',
      type: 'TRANSACTION',
      action: 'APPROVE',
      description: 'ID string válido'
    },
    {
      id: '999',
      type: 'TRANSACTION',
      action: 'REJECT',
      description: 'ID string válido mas inexistente'
    },
    {
      id: 'abc',
      type: 'TRANSACTION',
      action: 'APPROVE',
      description: 'ID string inválido (não numérico)'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- Teste: ${testCase.description} ---`);
    console.log('Dados enviados:', JSON.stringify({
      id: testCase.id,
      type: testCase.type,
      action: testCase.action
    }));
    
    try {
      const response = await apiRequest('/admin/process-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: testCase.id,
          type: testCase.type,
          action: testCase.action
        }),
      });
      
      console.log('✅ Sucesso:', response.message);
    } catch (error) {
      console.log('❌ Erro:', error.message);
    }
  }
}

// Executar testes
async function runTests() {
  try {
    const token = await loginAdmin();
    await testProcessAction(token);
    console.log('\n=== Testes concluídos ===');
  } catch (error) {
    console.error('Falha nos testes:', error.message);
  }
}

runTests();