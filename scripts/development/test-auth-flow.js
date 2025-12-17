/**
 * Script Automatizado de Fluxo de Autenticação
 * 
 * Este script realiza o fluxo completo de cadastro e autenticação de cliente:
 * 1. Registro de novo usuário
 * 2. Login do usuário
 * 3. Captura e armazenamento do token JWT
 * 4. Verificação da validade do token
 * 
 * @author Sistema Cred30
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';

// Configuração da API
const API_BASE_URL = 'http://localhost:3001/api';
const TOKENS_FILE = './auth-tokens.json';

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Utilitário para logging colorido
 */
const log = {
  info: (message) => console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
  warning: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  step: (message) => console.log(`${colors.blue}[STEP]${colors.reset} ${message}`),
  result: (message) => console.log(`${colors.magenta}[RESULT]${colors.reset} ${message}`)
};

/**
 * Gera dados aleatórios para teste
 */
function generateTestData() {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  
  return {
    name: `Usuário Teste ${timestamp}`,
    email: `test${timestamp}${randomNum}@example.com`,
    password: 'senha123',
    secretPhrase: `frase${timestamp}`,
    pixKey: `test${timestamp}@pix.com`
  };
}

/**
 * Envia requisição HTTP com tratamento de erros
 */
async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

  try {
    log.info(`Fazendo requisição para: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    log.success(`Requisição bem-sucedida: ${response.status}`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Timeout: A requisição demorou demais para responder');
    }
    
    throw error;
  }
}

/**
 * Valida a estrutura da resposta da API
 */
function validateResponse(response, expectedFields = []) {
  if (!response || typeof response !== 'object') {
    throw new Error('Resposta inválida: não é um objeto');
  }

  if (typeof response.success !== 'boolean') {
    throw new Error('Resposta inválida: campo "success" ausente ou inválido');
  }

  if (!response.success) {
    throw new Error(`API retornou erro: ${response.message || 'Erro desconhecido'}`);
  }

  if (!response.data) {
    throw new Error('Resposta inválida: campo "data" ausente');
  }

  // Verificar campos esperados
  for (const field of expectedFields) {
    if (!(field in response.data)) {
      throw new Error(`Resposta inválida: campo "${field}" ausente em data`);
    }
  }

  return true;
}

/**
 * Valida a estrutura do token JWT
 */
function validateJWT(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido: não é uma string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token inválido: formato JWT incorreto');
  }

  try {
    // Decodificar o payload (sem verificar assinatura)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    if (!payload.userId || !payload.exp) {
      throw new Error('Token inválido: payload malformado');
    }

    // Verificar se o token não está expirado
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token expirado');
    }

    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Token inválido: payload não é JSON válido');
    }
    throw error;
  }
}

/**
 * Carrega tokens existentes do arquivo
 */
function loadExistingTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    log.warning(`Não foi possível carregar tokens existentes: ${error.message}`);
  }
  
  return { tokens: [], lastUpdated: null };
}

/**
 * Salva token no arquivo JSON com timestamp
 */
function saveToken(tokenData) {
  try {
    const existingData = loadExistingTokens();
    
    const newTokenEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...tokenData
    };

    existingData.tokens.push(newTokenEntry);
    existingData.lastUpdated = new Date().toISOString();

    // Manter apenas os últimos 10 tokens para não sobrecarregar o arquivo
    if (existingData.tokens.length > 10) {
      existingData.tokens = existingData.tokens.slice(-10);
    }

    fs.writeFileSync(TOKENS_FILE, JSON.stringify(existingData, null, 2));
    log.success(`Token salvo em: ${TOKENS_FILE}`);
    
    return newTokenEntry;
  } catch (error) {
    throw new Error(`Falha ao salvar token: ${error.message}`);
  }
}

/**
 * Registra um novo usuário
 */
async function registerUser(userData) {
  log.step('Iniciando registro de novo usuário...');
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        secretPhrase: userData.secretPhrase,
        pixKey: userData.pixKey
      })
    });

    // Validar resposta
    validateResponse(response, ['user', 'token']);
    
    // Validar token
    const tokenPayload = validateJWT(response.data.token);
    
    log.success('Usuário registrado com sucesso!');
    log.result(`ID do usuário: ${response.data.user.id}`);
    log.result(`Email: ${response.data.user.email}`);
    log.result(`Token expira em: ${new Date(tokenPayload.exp * 1000).toLocaleString()}`);
    
    return {
      user: response.data.user,
      token: response.data.token,
      tokenPayload
    };
  } catch (error) {
    log.error(`Falha no registro: ${error.message}`);
    throw error;
  }
}

/**
 * Autentica usuário existente
 */
async function loginUser(userData) {
  log.step('Iniciando autenticação de usuário...');
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        secretPhrase: userData.secretPhrase
      })
    });

    // Validar resposta
    validateResponse(response, ['user', 'token']);
    
    // Validar token
    const tokenPayload = validateJWT(response.data.token);
    
    log.success('Usuário autenticado com sucesso!');
    log.result(`ID do usuário: ${response.data.user.id}`);
    log.result(`Email: ${response.data.user.email}`);
    log.result(`Token expira em: ${new Date(tokenPayload.exp * 1000).toLocaleString()}`);
    
    return {
      user: response.data.user,
      token: response.data.token,
      tokenPayload
    };
  } catch (error) {
    log.error(`Falha na autenticação: ${error.message}`);
    throw error;
  }
}

/**
 * Verifica se o token é válido fazendo uma requisição protegida
 */
async function verifyToken(token) {
  log.step('Verificando validade do token...');
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    validateResponse(response, ['user']);
    
    log.success('Token verificado com sucesso!');
    log.result(`Perfil do usuário carregado: ${response.data.user.name}`);
    
    return true;
  } catch (error) {
    log.error(`Falha na verificação do token: ${error.message}`);
    return false;
  }
}

/**
 * Executa testes de verificação do token salvo
 */
async function runTokenVerificationTests(savedToken) {
  log.step('Iniciando testes de verificação do token...');
  
  const testResults = {
    fileExists: false,
    tokenValid: false,
    tokenStructureValid: false,
    apiAccessValid: false
  };

  // Teste 1: Verificar se o arquivo foi criado
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      testResults.fileExists = true;
      log.success('✓ Arquivo de tokens criado com sucesso');
      
      // Ler e validar conteúdo
      const content = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      if (content.tokens && content.tokens.length > 0) {
        log.result(`✓ Total de tokens armazenados: ${content.tokens.length}`);
      }
    } else {
      log.error('✗ Arquivo de tokens não foi criado');
    }
  } catch (error) {
    log.error(`✗ Erro ao verificar arquivo: ${error.message}`);
  }

  // Teste 2: Validar estrutura do token
  try {
    const tokenPayload = validateJWT(savedToken.token);
    testResults.tokenStructureValid = true;
    log.success('✓ Estrutura do token JWT válida');
    log.result(`✓ UserID: ${tokenPayload.userId}`);
    log.result(`✓ Expira em: ${new Date(tokenPayload.exp * 1000).toLocaleString()}`);
  } catch (error) {
    log.error(`✗ Estrutura do token inválida: ${error.message}`);
  }

  // Teste 3: Verificar acesso à API com o token
  try {
    const isValid = await verifyToken(savedToken.token);
    if (isValid) {
      testResults.apiAccessValid = true;
      log.success('✓ Token válido para acesso à API');
    }
  } catch (error) {
    log.error(`✗ Falha no acesso à API: ${error.message}`);
  }

  // Resultado geral
  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  
  if (passedTests === totalTests) {
    log.success(`🎉 Todos os ${totalTests} testes passaram com sucesso!`);
  } else {
    log.warning(`⚠️  ${passedTests}/${totalTests} testes passaram`);
  }

  return testResults;
}

/**
 * Função principal que executa o fluxo completo
 */
async function runCompleteAuthFlow() {
  console.log(`${colors.bright}${colors.cyan}=== Sistema de Teste de Autenticação Cred30 ===${colors.reset}\n`);
  
  const results = {
    startTime: new Date().toISOString(),
    userData: null,
    registration: null,
    login: null,
    tokenSaved: null,
    verification: null,
    endTime: null,
    success: false,
    errors: []
  };

  try {
    // Gerar dados de teste
    results.userData = generateTestData();
    log.info('Dados de teste gerados:');
    log.result(`Nome: ${results.userData.name}`);
    log.result(`Email: ${results.userData.email}`);

    // Passo 1: Registrar usuário
    try {
      results.registration = await registerUser(results.userData);
    } catch (error) {
      results.errors.push(`Registro: ${error.message}`);
      throw error;
    }

    // Passo 2: Fazer login
    try {
      results.login = await loginUser(results.userData);
    } catch (error) {
      results.errors.push(`Login: ${error.message}`);
      throw error;
    }

    // Passo 3: Salvar token
    try {
      results.tokenSaved = saveToken({
        user: results.login.user,
        token: results.login.token,
        source: 'auth-flow-test',
        userData: {
          name: results.userData.name,
          email: results.userData.email
        }
      });
    } catch (error) {
      results.errors.push(`Salvamento: ${error.message}`);
      throw error;
    }

    // Passo 4: Verificar token
    try {
      results.verification = await runTokenVerificationTests(results.tokenSaved);
    } catch (error) {
      results.errors.push(`Verificação: ${error.message}`);
    }

    results.success = true;
    log.success('\n🎉 Fluxo de autenticação concluído com sucesso!');

  } catch (error) {
    results.success = false;
    results.endTime = new Date().toISOString();
    log.error(`\n❌ Falha no fluxo de autenticação: ${error.message}`);
  } finally {
    results.endTime = new Date().toISOString();
    
    // Salvar relatório completo
    const reportFile = `./auth-test-report-${Date.now()}.json`;
    try {
      fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
      log.info(`\n📄 Relatório completo salvo em: ${reportFile}`);
    } catch (error) {
      log.warning(`Não foi possível salvar relatório: ${error.message}`);
    }

    // Resumo final
    console.log(`\n${colors.bright}${colors.cyan}=== Resumo do Teste ===${colors.reset}`);
    console.log(`Início: ${results.startTime}`);
    console.log(`Fim: ${results.endTime}`);
    console.log(`Status: ${results.success ? '✅ SUCESSO' : '❌ FALHA'}`);
    
    if (results.errors.length > 0) {
      console.log(`\n${colors.red}Erros encontrados:${colors.reset}`);
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
  }

  return results;
}

/**
 * Função para testar múltiplos usuários simultaneamente
 */
async function runMultipleUserTests(count = 3) {
  console.log(`${colors.bright}${colors.yellow}=== Teste com Múltiplos Usuários (${count}) ===${colors.reset}\n`);
  
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    promises.push(
      runCompleteAuthFlow().catch(error => ({
        success: false,
        error: error.message,
        userIndex: i
      }))
    );
  }
  
  try {
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    
    log.result(`${successful}/${count} testes concluídos com sucesso`);
    
    return results;
  } catch (error) {
    log.error(`Erro nos testes simultâneos: ${error.message}`);
    return [];
  }
}

// Execução principal
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Uso: node test-auth-flow.js [opções]

Opções:
  --multiple [n]    Executa testes com múltiplos usuários (padrão: 3)
  --help            Mostra esta ajuda

Exemplos:
  node test-auth-flow.js
  node test-auth-flow.js --multiple 5
    `);
} else if (args.includes('--multiple')) {
  const count = parseInt(args[args.indexOf('--multiple') + 1]) || 3;
  runMultipleUserTests(count);
} else {
  runCompleteAuthFlow();
}

export {
  runCompleteAuthFlow,
  runMultipleUserTests,
  registerUser,
  loginUser,
  verifyToken,
  saveToken,
  validateJWT
};