/**
 * Script de teste para validar a configuração do CRED30 com ngrok único
 * Este script verifica se o proxy reverso está funcionando corretamente
 */

const axios = require('axios');

// Configurações
const config = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  timeout: 10000
};

// Credenciais de teste
const credentials = {
  admin: {
    email: 'admin@cred30.com',
    password: 'admin123'
  },
  client: {
    email: 'joao@cred30.com',
    password: 'cliente123'
  }
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️ ${message}`, colors.blue);
}

function logHeader(message) {
  log(`\n🔍 ${message}`, colors.cyan);
}

// Teste de conectividade básica
async function testConnectivity() {
  logHeader('Testando Conectividade Básica');
  
  try {
    // Testar frontend
    logInfo('Testando acesso ao frontend...');
    const frontendResponse = await axios.get(config.frontendUrl, { timeout: config.timeout });
    if (frontendResponse.status === 200) {
      logSuccess(`Frontend acessível: ${config.frontendUrl}`);
    }
  } catch (error) {
    logError(`Frontend inacessível: ${config.frontendUrl}`);
    throw error;
  }

  try {
    // Testar backend via proxy
    logInfo('Testando acesso ao backend via proxy...');
    const backendResponse = await axios.get(`${config.frontendUrl}/api/health`, { timeout: config.timeout });
    if (backendResponse.status === 200) {
      logSuccess(`Backend acessível via proxy: ${config.frontendUrl}/api`);
    }
  } catch (error) {
    logError(`Backend inacessível via proxy: ${config.frontendUrl}/api`);
    throw error;
  }
}

// Teste de autenticação
async function testAuthentication() {
  logHeader('Testando Autenticação via Proxy');
  
  let adminToken = null;
  let clientToken = null;

  try {
    // Testar login admin
    logInfo('Testando login do administrador...');
    const adminResponse = await axios.post(`${config.frontendUrl}/api/auth/login`, credentials.admin, { timeout: config.timeout });
    
    if (adminResponse.data && adminResponse.data.token) {
      adminToken = adminResponse.data.token;
      logSuccess('Login admin realizado com sucesso via proxy');
    } else {
      throw new Error('Token não recebido no login admin');
    }
  } catch (error) {
    logError(`Falha no login admin: ${error.message}`);
    throw error;
  }

  try {
    // Testar login cliente
    logInfo('Testando login do cliente...');
    const clientResponse = await axios.post(`${config.frontendUrl}/api/auth/login`, credentials.client, { timeout: config.timeout });
    
    if (clientResponse.data && clientResponse.data.token) {
      clientToken = clientResponse.data.token;
      logSuccess('Login cliente realizado com sucesso via proxy');
    } else {
      throw new Error('Token não recebido no login cliente');
    }
  } catch (error) {
    logError(`Falha no login cliente: ${error.message}`);
    throw error;
  }

  return { adminToken, clientToken };
}

// Teste de endpoints principais via proxy
async function testMainEndpoints(tokens) {
  logHeader('Testando Endpoints Principais via Proxy');
  
  const { adminToken, clientToken } = tokens;

  // Endpoints que não requerem autenticação
  const publicEndpoints = [
    { method: 'GET', path: '/api/health', description: 'Health check' }
  ];

  // Endpoints de cliente
  const clientEndpoints = [
    { method: 'GET', path: '/api/users/profile', description: 'Perfil do cliente' },
    { method: 'GET', path: '/api/quotas', description: 'Cotas do cliente' },
    { method: 'GET', path: '/api/transactions', description: 'Transações do cliente' }
  ];

  // Endpoints de admin
  const adminEndpoints = [
    { method: 'GET', path: '/api/admin/dashboard', description: 'Dashboard admin' },
    { method: 'GET', path: '/api/admin/users', description: 'Lista de usuários' },
    { method: 'GET', path: '/api/admin/loans', description: 'Lista de empréstimos' },
    { method: 'GET', path: '/api/admin/withdrawals', description: 'Lista de saques' }
  ];

  // Testar endpoints públicos
  logInfo('Testando endpoints públicos...');
  for (const endpoint of publicEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${config.frontendUrl}${endpoint.path}`,
        timeout: config.timeout
      });
      
      if (response.status === 200) {
        logSuccess(`${endpoint.description}: OK`);
      }
    } catch (error) {
      logError(`${endpoint.description}: ${error.message}`);
    }
  }

  // Testar endpoints de cliente
  logInfo('Testando endpoints de cliente...');
  for (const endpoint of clientEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${config.frontendUrl}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${clientToken}` },
        timeout: config.timeout
      });
      
      if (response.status === 200) {
        logSuccess(`${endpoint.description}: OK`);
      }
    } catch (error) {
      logError(`${endpoint.description}: ${error.message}`);
    }
  }

  // Testar endpoints de admin
  logInfo('Testando endpoints de admin...');
  for (const endpoint of adminEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${config.frontendUrl}${endpoint.path}`,
        headers: { 'Authorization': `Bearer ${adminToken}` },
        timeout: config.timeout
      });
      
      if (response.status === 200) {
        logSuccess(`${endpoint.description}: OK`);
      }
    } catch (error) {
      logError(`${endpoint.description}: ${error.message}`);
    }
  }
}

// Teste de funcionalidades específicas via proxy
async function testFunctionalities() {
  logHeader('Testando Funcionalidades Específicas via Proxy');
  
  // Testar criação de empréstimo
  try {
    logInfo('Testando criação de empréstimo...');
    const loanData = {
      amount: 500,
      term_days: 30
    };
    
    // Primeiro fazer login para obter token
    const loginResponse = await axios.post(`${config.frontendUrl}/api/auth/login`, credentials.client);
    const token = loginResponse.data.token;
    
    const loanResponse = await axios.post(
      `${config.frontendUrl}/api/loans`,
      loanData,
      { 
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: config.timeout
      }
    );
    
    if (loanResponse.status === 201) {
      logSuccess('Criação de empréstimo: OK via proxy');
    }
  } catch (error) {
    logError(`Criação de empréstimo: ${error.message}`);
  }

  // Testar requisição de saque
  try {
    logInfo('Testando requisição de saque...');
    const withdrawalData = {
      amount: 100,
      pix_key: 'test@pix.com'
    };
    
    // Primeiro fazer login para obter token
    const loginResponse = await axios.post(`${config.frontendUrl}/api/auth/login`, credentials.client);
    const token = loginResponse.data.token;
    
    const withdrawalResponse = await axios.post(
      `${config.frontendUrl}/api/withdrawals`,
      withdrawalData,
      { 
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: config.timeout
      }
    );
    
    if (withdrawalResponse.status === 201) {
      logSuccess('Requisição de saque: OK via proxy');
    }
  } catch (error) {
    logError(`Requisição de saque: ${error.message}`);
  }
}

// Função principal
async function runTests() {
  log('\n🚀 Iniciando Testes de Integração CRED30 com ngrok Único');
  log('=' .repeat(60));
  
  logInfo(`Frontend URL: ${config.frontendUrl}`);
  logInfo(`Backend URL via proxy: ${config.frontendUrl}/api`);
  log('');

  try {
    await testConnectivity();
    const tokens = await testAuthentication();
    await testMainEndpoints(tokens);
    await testFunctionalities();
    
    log('\n' + '='.repeat(60));
    logSuccess('🎉 Testes concluídos com sucesso!');
    logInfo('A plataforma CRED30 está funcionando corretamente com ngrok único e proxy reverso.');
    
  } catch (error) {
    log('\n' + '='.repeat(60));
    logError('❌ Testes falharam!');
    logError(`Erro: ${error.message}`);
    logWarning('Verifique os logs dos containers e a configuração do proxy.');
    process.exit(1);
  }
}

// Função para mostrar ajuda
function showHelp() {
  log('\n📖 Como usar:');
  log('   node test-single-ngrok.js');
  log('   FRONTEND_URL=https://abc-123.ngrok-free.app node test-single-ngrok.js');
  log('');
  log('🔧 Variáveis de ambiente:');
  log('   FRONTEND_URL: URL pública do frontend (padrão: http://localhost:5173)');
  log('');
}

// Executar testes
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  runTests().catch(error => {
    logError(`Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests, testConnectivity, testAuthentication, testMainEndpoints, testFunctionalities };