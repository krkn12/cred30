/**
 * Script de Teste de Rotas do Cliente
 * 
 * Este script utiliza um token JWT existente para testar todas as rotas
 * disponíveis para clientes no sistema Cred30, verificando funcionamento,
 * validações e respostas da API.
 * 
 * @author Sistema Cred30
 * @version 1.0.0
 */

import fs from 'fs';

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
  cyan: '\x1b[36m',
  white: '\x1b[37m'
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
  result: (message) => console.log(`${colors.magenta}[RESULT]${colors.reset} ${message}`),
  route: (method, route, status) => {
    const statusColor = status >= 200 && status < 300 ? colors.green : 
                       status >= 400 && status < 500 ? colors.yellow : colors.red;
    console.log(`${colors.white}[ROUTE]${colors.reset} ${method} ${route} ${statusColor}${status}${colors.reset}`);
  }
};

/**
 * Carrega o token mais recente do arquivo
 */
function loadLatestToken() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      throw new Error(`Arquivo ${TOKENS_FILE} não encontrado. Execute primeiro o test-auth-flow.js`);
    }

    const content = fs.readFileSync(TOKENS_FILE, 'utf8');
    const data = JSON.parse(content);
    
    if (!data.tokens || data.tokens.length === 0) {
      throw new Error('Nenhum token encontrado no arquivo');
    }

    // Retornar o token mais recente
    const latestToken = data.tokens[data.tokens.length - 1];
    
    log.success(`Token carregado: ${latestToken.user.name} (${latestToken.user.email})`);
    
    // Verificar se o tokenPayload existe e tem exp
    if (!latestToken.tokenPayload || !latestToken.tokenPayload.exp) {
      // Decodificar o token manualmente para obter o payload
      try {
        const parts = latestToken.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          latestToken.tokenPayload = payload;
          log.result(`Token expira em: ${new Date(payload.exp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Token com formato inválido');
        }
      } catch (error) {
        throw new Error(`Não foi possível decodificar o token: ${error.message}`);
      }
    } else {
      log.result(`Token expira em: ${new Date(latestToken.tokenPayload.exp * 1000).toLocaleString()}`);
    }
    
    return latestToken;
  } catch (error) {
    log.error(`Falha ao carregar token: ${error.message}`);
    throw error;
  }
}

/**
 * Envia requisição HTTP com tratamento de erros
 */
async function makeRequest(method, endpoint, token, body = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    log.info(`${method} ${endpoint}`);
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => ({}));
    
    log.route(method, endpoint, response.status);
    
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: responseData.message || response.statusText,
        data: responseData
      };
    }

    return {
      success: true,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      log.error(`Timeout na requisição ${method} ${endpoint}`);
      return {
        success: false,
        error: 'Timeout: A requisição demorou demais'
      };
    }
    
    log.error(`Erro na requisição ${method} ${endpoint}: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Testa rotas de usuário
 */
async function testUserRoutes(token) {
  log.step('\n=== Testando Rotas de Usuário ===');
  
  const results = {
    profile: null,
    updateProfile: null,
    balance: null,
    transactions: null
  };

  // GET /users/profile
  log.info('Testando GET /users/profile');
  results.profile = await makeRequest('GET', '/users/profile', token);
  if (results.profile.success) {
    log.success('✓ Perfil do usuário obtido com sucesso');
    log.result(`Nome: ${results.profile.data.data.user.name}`);
    log.result(`Email: ${results.profile.data.data.user.email}`);
    log.result(`Saldo: R$ ${results.profile.data.data.user.balance.toFixed(2)}`);
  }

  // GET /users/balance
  log.info('Testando GET /users/balance');
  results.balance = await makeRequest('GET', '/users/balance', token);
  if (results.balance.success) {
    log.success('✓ Saldo obtido com sucesso');
    log.result(`Saldo atual: R$ ${results.balance.data.data.balance.toFixed(2)}`);
  }

  // GET /users/transactions
  log.info('Testando GET /users/transactions');
  results.transactions = await makeRequest('GET', '/users/transactions', token);
  if (results.transactions.success) {
    log.success('✓ Extrato de transações obtido com sucesso');
    const transactions = results.transactions.data.data.transactions;
    log.result(`Total de transações: ${transactions.length}`);
    if (transactions.length > 0) {
      log.result(`Última transação: ${transactions[0].description}`);
    }
  }

  // PUT /users/profile (teste de atualização)
  log.info('Testando PUT /users/profile');
  const updateData = {
    name: `Usuário Atualizado ${Date.now()}`,
    pixKey: `novo-pix-${Date.now()}@test.com`
  };
  results.updateProfile = await makeRequest('PUT', '/users/profile', token, updateData);
  if (results.updateProfile.success) {
    log.success('✓ Perfil atualizado com sucesso');
    log.result(`Novo nome: ${updateData.name}`);
  }

  return results;
}

/**
 * Testa rotas de cotas
 */
async function testQuotaRoutes(token) {
  log.step('\n=== Testando Rotas de Cotas ===');
  
  const results = {
    list: null,
    buy: null,
    sell: null,
    sellAll: null
  };

  // GET /quotas
  log.info('Testando GET /quotas');
  results.list = await makeRequest('GET', '/quotas', token);
  if (results.list.success) {
    log.success('✓ Lista de cotas obtida com sucesso');
    const quotas = results.list.data.data.quotas;
    log.result(`Total de cotas: ${quotas.length}`);
    
    if (quotas.length > 0) {
      quotas.forEach((quota, index) => {
        log.result(`Cota ${index + 1}: R$ ${quota.purchasePrice.toFixed(2)} (Valor atual: R$ ${quota.currentValue.toFixed(2)})`);
      });
    }
  }

  // POST /quotas/buy (compra usando saldo)
  log.info('Testando POST /quotas/buy (com saldo)');
  const buyData = {
    quantity: 1,
    useBalance: false // Usar PIX para teste
  };
  results.buy = await makeRequest('POST', '/quotas/buy', token, buyData);
  if (results.buy.success) {
    log.success('✓ Solicitação de compra enviada com sucesso');
    log.result(`Quantidade: ${buyData.quantity}`);
    log.result(`Forma de pagamento: ${buyData.useBalance ? 'Saldo' : 'PIX'}`);
  } else {
    log.warning(`Compra falhou: ${results.buy.error}`);
  }

  // POST /quotas/sell (vender uma cota)
  if (results.list.success && results.list.data.data.quotas.length > 0) {
    log.info('Testando POST /quotas/sell');
    const sellData = {
      quotaId: results.list.data.data.quotas[0].id.toString()
    };
    results.sell = await makeRequest('POST', '/quotas/sell', token, sellData);
    if (results.sell.success) {
      log.success('✓ Venda de cota realizada com sucesso');
      log.result(`Valor recebido: R$ ${results.sell.data.data.finalAmount.toFixed(2)}`);
    } else {
      log.warning(`Venda falhou: ${results.sell.error}`);
    }
  } else {
    log.warning('Pulando teste de venda: usuário não possui cotas');
  }

  // POST /quotas/sell-all
  if (results.list.success && results.list.data.data.quotas.length > 1) {
    log.info('Testando POST /quotas/sell-all');
    results.sellAll = await makeRequest('POST', '/quotas/sell-all', token);
    if (results.sellAll.success) {
      log.success('✓ Venda de todas as cotas realizada com sucesso');
      log.result(`Total recebido: R$ ${results.sellAll.data.data.totalReceived.toFixed(2)}`);
    } else {
      log.warning(`Venda total falhou: ${results.sellAll.error}`);
    }
  } else {
    log.warning('Pulando teste de venda total: usuário não possui cotas suficientes');
  }

  return results;
}

/**
 * Testa rotas de empréstimos
 */
async function testLoanRoutes(token) {
  log.step('\n=== Testando Rotas de Empréstimos ===');
  
  const results = {
    list: null,
    request: null,
    repay: null
  };

  // GET /loans
  log.info('Testando GET /loans');
  results.list = await makeRequest('GET', '/loans', token);
  if (results.list.success) {
    log.success('✓ Lista de empréstimos obtida com sucesso');
    const loans = results.list.data.data.loans;
    log.result(`Total de empréstimos: ${loans.length}`);
    
    if (loans.length > 0) {
      loans.forEach((loan, index) => {
        log.result(`Empréstimo ${index + 1}: R$ ${loan.amount.toFixed(2)} (${loan.installments}x) - Status: ${loan.status}`);
      });
    }
  }

  // POST /loans/request
  log.info('Testando POST /loans/request');
  const loanData = {
    amount: 100,
    installments: 3,
    receivePixKey: `test-pix-${Date.now()}@example.com`
  };
  results.request = await makeRequest('POST', '/loans/request', token, loanData);
  if (results.request.success) {
    log.success('✓ Solicitação de empréstimo enviada com sucesso');
    log.result(`Valor: R$ ${loanData.amount.toFixed(2)}`);
    log.result(`Parcelas: ${loanData.installments}x`);
    log.result(`PIX: ${loanData.receivePixKey}`);
  } else {
    log.warning(`Solicitação de empréstimo falhou: ${results.request.error}`);
  }

  // POST /loans/repay (pagar empréstimo)
  if (results.list.success && results.list.data.data.loans.length > 0) {
    const activeLoan = results.list.data.data.loans.find(loan => loan.status === 'APPROVED');
    if (activeLoan) {
      log.info('Testando POST /loans/repay');
      const repayData = {
        loanId: activeLoan.id.toString(),
        useBalance: false // Usar PIX para teste
      };
      results.repay = await makeRequest('POST', '/loans/repay', token, repayData);
      if (results.repay.success) {
        log.success('✓ Pagamento de empréstimo solicitado com sucesso');
        log.result(`Empréstimo ID: ${repayData.loanId}`);
      } else {
        log.warning(`Pagamento de empréstimo falhou: ${results.repay.error}`);
      }
    } else {
      log.warning('Pulando teste de pagamento: nenhum empréstimo ativo encontrado');
    }
  } else {
    log.warning('Pulando teste de pagamento: usuário não possui empréstimos');
  }

  return results;
}

/**
 * Testa rotas de transações
 */
async function testTransactionRoutes(token) {
  log.step('\n=== Testando Rotas de Transações ===');
  
  const results = {
    list: null,
    withdraw: null,
    balance: null
  };

  // GET /transactions
  log.info('Testando GET /transactions');
  results.list = await makeRequest('GET', '/transactions', token);
  if (results.list.success) {
    log.success('✓ Lista de transações obtida com sucesso');
    const transactions = results.list.data.data.transactions;
    log.result(`Total de transações: ${transactions.length}`);
    
    if (transactions.length > 0) {
      transactions.slice(0, 3).forEach((transaction, index) => {
        log.result(`Transação ${index + 1}: ${transaction.type} - R$ ${transaction.amount.toFixed(2)} (${transaction.status})`);
      });
    }
  }

  // GET /transactions/balance
  log.info('Testando GET /transactions/balance');
  results.balance = await makeRequest('GET', '/transactions/balance', token);
  if (results.balance.success) {
    log.success('✓ Saldo obtido com sucesso');
    log.result(`Saldo atual: R$ ${results.balance.data.data.balance.toFixed(2)}`);
  }

  // POST /transactions/withdraw
  log.info('Testando POST /transactions/withdraw');
  const withdrawData = {
    amount: 10,
    pixKey: `saque-test-${Date.now()}@pix.com`
  };
  results.withdraw = await makeRequest('POST', '/transactions/withdraw', token, withdrawData);
  if (results.withdraw.success) {
    log.success('✓ Solicitação de saque enviada com sucesso');
    log.result(`Valor: R$ ${withdrawData.amount.toFixed(2)}`);
    log.result(`PIX: ${withdrawData.pixKey}`);
  } else {
    log.warning(`Solicitação de saque falhou: ${results.withdraw.error}`);
  }

  return results;
}

/**
 * Testa acesso a rota sem token (deve falhar)
 */
async function testUnauthorizedAccess() {
  log.step('\n=== Testando Acesso Não Autorizado ===');
  
  // Tentar acessar rota protegida sem token
  const result = await makeRequest('GET', '/users/profile', '');
  if (!result.success && result.status === 401) {
    log.success('✓ Acesso não autorizado corretamente bloqueado');
  } else {
    log.error('✗ Falha na proteção de rota: acesso sem token foi permitido');
  }
}

/**
 * Testa acesso com token inválido
 */
async function testInvalidToken() {
  log.step('\n=== Testando Token Inválido ===');
  
  const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token';
  
  const result = await makeRequest('GET', '/users/profile', invalidToken);
  if (!result.success && result.status === 401) {
    log.success('✓ Token inválido corretamente rejeitado');
  } else {
    log.error('✗ Falha na validação de token: token inválido foi aceito');
  }
}

/**
 * Gera relatório completo dos testes
 */
function generateReport(testResults, tokenInfo) {
  const report = {
    timestamp: new Date().toISOString(),
    tokenInfo: {
      user: tokenInfo.user,
      expiresAt: new Date(tokenInfo.tokenPayload.exp * 1000).toISOString(),
      isValid: tokenInfo.tokenPayload.exp > Date.now() / 1000
    },
    results: testResults,
    summary: {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0
    }
  };

  // Contar testes
  Object.values(testResults).forEach(categoryResults => {
    if (categoryResults) {
      Object.values(categoryResults).forEach(result => {
        if (result) {
          report.summary.totalTests++;
          if (result.success) {
            report.summary.successfulTests++;
          } else {
            report.summary.failedTests++;
          }
        }
      });
    }
  });

  // Salvar relatório
  const reportFile = `./client-routes-test-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  log.info(`\n📄 Relatório completo salvo em: ${reportFile}`);
  
  return report;
}

/**
 * Função principal
 */
async function runClientRoutesTests() {
  console.log(`${colors.bright}${colors.cyan}=== Teste Completo de Rotas do Cliente ===${colors.reset}\n`);
  
  try {
    // Carregar token
    const tokenInfo = loadLatestToken();
    const token = tokenInfo.token;
    
    // Verificar se o token ainda é válido
    const now = Date.now() / 1000;
    if (tokenInfo.tokenPayload.exp < now) {
      log.error('Token expirado! Execute novamente o test-auth-flow.js para gerar um novo token.');
      return;
    }
    
    const testResults = {};
    
    // Executar testes de cada categoria de rota
    testResults.users = await testUserRoutes(token);
    testResults.quotas = await testQuotaRoutes(token);
    testResults.loans = await testLoanRoutes(token);
    testResults.transactions = await testTransactionRoutes(token);
    
    // Testes de segurança
    await testUnauthorizedAccess();
    await testInvalidToken();
    
    // Gerar relatório
    const report = generateReport(testResults, tokenInfo);
    
    // Exibir resumo final
    console.log(`\n${colors.bright}${colors.cyan}=== Resumo dos Testes ===${colors.reset}`);
    console.log(`Total de testes: ${report.summary.totalTests}`);
    console.log(`${colors.green}Sucessos: ${report.summary.successfulTests}${colors.reset}`);
    console.log(`${colors.red}Falhas: ${report.summary.failedTests}${colors.reset}`);
    
    const successRate = ((report.summary.successfulTests / report.summary.totalTests) * 100).toFixed(1);
    console.log(`Taxa de sucesso: ${successRate}%`);
    
    if (report.summary.failedTests === 0) {
      log.success('\n🎉 Todos os testes passaram com sucesso!');
    } else {
      log.warning(`\n⚠️ ${report.summary.failedTests} testes falharam. Verifique o relatório para detalhes.`);
    }
    
  } catch (error) {
    log.error(`\n❌ Falha geral nos testes: ${error.message}`);
    process.exit(1);
  }
}

// Execução principal
if (import.meta.main || process.argv.length > 1) {
  runClientRoutesTests();
}

export {
  runClientRoutesTests,
  testUserRoutes,
  testQuotaRoutes,
  testLoanRoutes,
  testTransactionRoutes
};