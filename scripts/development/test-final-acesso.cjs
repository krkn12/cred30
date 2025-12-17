/**
 * Script de Teste Final para Verificar Acesso ao Sistema Cred30
 * 
 * Este script verifica se todos os componentes estão funcionando:
 * - Frontend (porta 5173)
 * - Backend (porta 3000)
 * - Proxy reverso (/api)
 * - Autenticação
 * - Endpoints principais
 */

const http = require('http');
const https = require('https');

// Configurações
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:5173/api';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cred30-Test-Script/1.0'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testComponent(name, url, expectedStatus = 200) {
  try {
    log(`\n🔍 Testando ${name}...`, 'cyan');
    log(`   URL: ${url}`, 'blue');
    
    const response = await makeRequest(url);
    
    if (response.statusCode === expectedStatus) {
      log(`   ✅ ${name} funcionando! (Status: ${response.statusCode})`, 'green');
      return true;
    } else {
      log(`   ❌ ${name} com problema! (Status: ${response.statusCode})`, 'red');
      log(`   Body: ${response.body.substring(0, 200)}...`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`   ❌ ${name} falhou! Erro: ${error.message}`, 'red');
    return false;
  }
}

async function testAuth() {
  try {
    log(`\n🔐 Testando Autenticação...`, 'cyan');
    
    // Testar login admin
    const adminData = {
      email: 'admin@cred30.com',
      password: 'admin123'
    };
    
    const response = await makeRequest(`${API_URL}/auth/login`, 'POST', adminData);
    
    if (response.statusCode === 200) {
      const result = JSON.parse(response.body);
      if (result.success && result.data?.token) {
        log(`   ✅ Login admin funcionando!`, 'green');
        log(`   Token: ${result.data.token.substring(0, 20)}...`, 'blue');
        return { success: true, token: result.data.token };
      } else {
        log(`   ❌ Login admin retornou formato inválido!`, 'red');
        return { success: false };
      }
    } else {
      log(`   ❌ Login admin falhou! (Status: ${response.statusCode})`, 'red');
      log(`   Body: ${response.body}`, 'yellow');
      return { success: false };
    }
  } catch (error) {
    log(`   ❌ Teste de autenticação falhou! Erro: ${error.message}`, 'red');
    return { success: false };
  }
}

async function testProtectedEndpoints(token) {
  try {
    log(`\n🛡️ Testando Endpoints Protegidos...`, 'cyan');
    
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Testar endpoint de usuário
    const userResponse = await makeRequest(`${API_URL}/users/profile`);
    
    if (userResponse.statusCode === 200) {
      log(`   ✅ Endpoint de perfil funcionando!`, 'green');
      return true;
    } else {
      log(`   ❌ Endpoint de perfil falhou! (Status: ${userResponse.statusCode})`, 'red');
      return false;
    }
  } catch (error) {
    log(`   ❌ Teste de endpoints protegidos falhou! Erro: ${error.message}`, 'red');
    return false;
  }
}

async function runCompleteTest() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🚀 TESTE COMPLETO DO SISTEMA CRED30', 'cyan');
  log('='.repeat(60), 'cyan');
  
  let results = {
    frontend: false,
    backend: false,
    api: false,
    auth: false,
    protected: false
  };
  
  // Testar componentes básicos
  results.frontend = await testComponent('Frontend', FRONTEND_URL);
  results.backend = await testComponent('Backend', `${BACKEND_URL}/api/health`);
  results.api = await testComponent('API via Proxy', `${API_URL}/health`);
  
  // Testar autenticação
  const authResult = await testAuth();
  results.auth = authResult.success;
  
  // Testar endpoints protegidos (se auth funcionou)
  if (authResult.success) {
    results.protected = await testProtectedEndpoints(authResult.token);
  }
  
  // Resumo final
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 RESUMO DOS TESTES', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const successCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.keys(results).length;
  
  Object.entries(results).forEach(([component, success]) => {
    const status = success ? '✅ FUNCIONANDO' : '❌ FALHOU';
    const color = success ? 'green' : 'red';
    log(`${component.padEnd(15)}: ${status}`, color);
  });
  
  log(`\nTotal: ${successCount}/${totalCount} componentes funcionando`, 
      successCount === totalCount ? 'green' : 'yellow');
  
  if (successCount === totalCount) {
    log('\n🎉 SISTEMA 100% FUNCIONAL! Parabéns!', 'green');
    log('\n🌐 Acesse agora:', 'cyan');
    log(`   Local: ${FRONTEND_URL}`, 'blue');
    log(`   Inicie ngrok: ngrok http 5173`, 'blue');
  } else {
    log('\n⚠️  Alguns componentes precisam de atenção!', 'yellow');
    log('   Verifique os logs acima para detalhes dos problemas.', 'yellow');
  }
  
  log('\n' + '='.repeat(60), 'cyan');
}

// Executar teste
if (require.main === module) {
  runCompleteTest().catch(error => {
    log(`\n💥 Erro fatal no teste: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runCompleteTest, testComponent, testAuth };