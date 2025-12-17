/**
 * Script de Integração Frontend-Backend
 *
 * Este script simula as interações do frontend com o backend
 * utilizando as mesmas estruturas de dados e chamadas de API
 * que o frontend real utiliza.
 *
 * Baseado nos serviços:
 * - services/apiService.ts
 * - services/apiStorageService.ts
 * - types.ts
 * - constants.ts
 */

import fs from 'fs';
import path from 'path';

// Configuração da API (mesma do frontend)
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Constantes do frontend
const QUOTA_PRICE = 50.00;
const LOAN_INTEREST_RATE = 0.20; // 20% ao mês
const PENALTY_RATE = 0.40; // 40% de multa por resgate antecipado
const ADMIN_PIX_KEY = "91980177874";

// Cores para console
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

// Logger estruturado
const logger = {
  info: (message, data = null) => {
    console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
    if (data) console.log(`${colors.cyan}    Data:${colors.reset}`, data);
  },
  success: (message, data = null) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
    if (data) console.log(`${colors.green}    Data:${colors.reset}`, data);
  },
  warning: (message, data = null) => {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
    if (data) console.log(`${colors.yellow}    Data:${colors.reset}`, data);
  },
  error: (message, data = null) => {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
    if (data) console.log(`${colors.red}    Data:${colors.reset}`, data);
  }
};

// Classe ApiService (baseada no frontend)
class ApiService {
  constructor() {
    this.token = null;
    this.loadToken();
  }

  loadToken() {
    try {
      if (fs.existsSync('auth-tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('auth-tokens.json', 'utf8'));
        if (tokens.length > 0) {
          this.token = tokens[0].token;
          logger.info('Token carregado do arquivo auth-tokens.json');
        }
      }
    } catch (error) {
      logger.error('Erro ao carregar token:', error.message);
    }
  }

  saveToken(token, user) {
    this.token = token;
    try {
      let tokens = [];
      if (fs.existsSync('auth-tokens.json')) {
        const fileContent = fs.readFileSync('auth-tokens.json', 'utf8');
        if (fileContent.trim()) {
          tokens = JSON.parse(fileContent);
        }
      }
      
      if (!Array.isArray(tokens)) {
        tokens = [];
      }
      
      tokens.unshift({
        token,
        user,
        timestamp: new Date().toISOString()
      });

      // Manter apenas os 10 tokens mais recentes
      tokens = tokens.slice(0, 10);
      
      fs.writeFileSync('auth-tokens.json', JSON.stringify(tokens, null, 2));
      logger.success('Token salvo com sucesso');
    } catch (error) {
      logger.error('Erro ao salvar token:', error.message);
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      logger.info(`Fazendo requisição: ${options.method || 'GET'} ${endpoint}`);
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro na requisição');
      }

      logger.success(`Requisição bem-sucedida: ${endpoint}`);
      return data;
    } catch (error) {
      logger.error(`Erro na requisição ${endpoint}:`, error.message);
      throw error;
    }
  }

  // Métodos de autenticação
  async login(email, password, secretPhrase) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase }),
    });

    this.saveToken(response.data.token, response.data.user);
    return response.data;
  }

  async register(name, email, password, secretPhrase, pixKey, referralCode) {
    const requestBody = { name, email, password, secretPhrase, pixKey };
    if (referralCode) {
      requestBody.referralCode = referralCode;
    }
    
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    this.saveToken(response.data.token, response.data.user);
    return response.data;
  }

  // Métodos do usuário
  async getUserProfile() {
    const response = await this.request('/users/profile');
    return response.data;
  }

  async getUserBalance() {
    const response = await this.request('/users/balance');
    return response.data;
  }

  async getUserTransactions() {
    const response = await this.request('/users/transactions');
    return response.data;
  }

  async getUserQuotas() {
    const response = await this.request('/quotas');
    return response.data;
  }

  async getUserLoans() {
    const response = await this.request('/loans');
    return response.data;
  }

  // Métodos de operações
  async buyQuotas(quantity, useBalance = false) {
    const response = await this.request('/quotas/buy', {
      method: 'POST',
      body: JSON.stringify({ quantity, useBalance }),
    });
    return response.data;
  }

  async sellQuota(quotaId) {
    const response = await this.request('/quotas/sell', {
      method: 'POST',
      body: JSON.stringify({ quotaId }),
    });
    return response.data;
  }

  async sellAllQuotas() {
    const response = await this.request('/quotas/sell-all', {
      method: 'POST',
    });
    return response.data;
  }

  async requestLoan(amount, installments, receivePixKey) {
    const response = await this.request('/loans/request', {
      method: 'POST',
      body: JSON.stringify({ amount, installments, receivePixKey }),
    });
    return response.data;
  }

  async repayLoan(loanId, useBalance = false) {
    const response = await this.request('/loans/repay', {
      method: 'POST',
      body: JSON.stringify({ loanId, useBalance }),
    });
    return response.data;
  }

  async requestWithdrawal(amount, pixKey) {
    const response = await this.request('/transactions/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, pixKey }),
    });
    return response.data;
  }

  // Métodos administrativos
  async getAdminDashboard() {
    const response = await this.request('/admin/dashboard');
    return response.data;
  }

  async updateSystemBalance(newBalance) {
    const response = await this.request('/admin/system-balance', {
      method: 'POST',
      body: JSON.stringify({ newBalance }),
    });
    return response.data;
  }

  async addProfitToPool(amountToAdd) {
    const response = await this.request('/admin/profit-pool', {
      method: 'POST',
      body: JSON.stringify({ amountToAdd }),
    });
    return response.data;
  }

  async processAdminAction(id, type, action) {
    // Enviar exatamente como o frontend: ID como string, type e action como strings
    const response = await this.request('/admin/process-action', {
      method: 'POST',
      body: JSON.stringify({ id: String(id), type: String(type), action: String(action) }),
    });
    return response.data;
  }

  async distributeDividends() {
    const response = await this.request('/admin/distribute-dividends', {
      method: 'POST',
    });
    return response.data;
  }

  isAuthenticated() {
    return !!this.token;
  }
}

// Funções utilitárias (baseadas no frontend)
const convertApiUserToUser = (apiUser) => {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    secretPhrase: '', // Não é retornado pela API
    pixKey: apiUser.pixKey,
    balance: apiUser.balance,
    joinedAt: apiUser.joinedAt,
    referralCode: apiUser.referralCode,
    isAdmin: apiUser.isAdmin || false,
  };
};

const convertApiQuotaToQuota = (apiQuota) => {
  return {
    id: apiQuota.id,
    userId: apiQuota.userId,
    purchasePrice: apiQuota.purchasePrice,
    purchaseDate: apiQuota.purchaseDate,
    currentValue: apiQuota.currentValue,
    yieldRate: apiQuota.yieldRate,
  };
};

const convertApiLoanToLoan = (apiLoan) => {
  return {
    id: apiLoan.id,
    userId: apiLoan.userId,
    amount: apiLoan.amount,
    totalRepayment: apiLoan.totalRepayment,
    installments: apiLoan.installments,
    interestRate: apiLoan.interestRate,
    requestDate: apiLoan.requestDate,
    status: apiLoan.status,
    pixKeyToReceive: apiLoan.pixKeyToReceive,
    dueDate: apiLoan.dueDate,
  };
};

const convertApiTransactionToTransaction = (apiTransaction) => {
  return {
    id: apiTransaction.id,
    userId: apiTransaction.userId,
    type: apiTransaction.type,
    amount: apiTransaction.amount,
    date: apiTransaction.date,
    description: apiTransaction.description,
    status: apiTransaction.status,
    metadata: apiTransaction.metadata,
  };
};

// Função para carregar estado completo (baseada no frontend)
const loadState = async (api) => {
  try {
    if (!api.isAuthenticated()) {
      return {
        currentUser: null,
        users: [],
        quotas: [],
        loans: [],
        transactions: [],
        systemBalance: 0,
        profitPool: 0,
      };
    }

    const userProfile = await api.getUserProfile();
    const currentUser = convertApiUserToUser(userProfile.user);

    const transactionsResponse = await api.getUserTransactions();
    const transactions = transactionsResponse.transactions.map(convertApiTransactionToTransaction);

    const quotasResponse = await api.getUserQuotas();
    const quotas = quotasResponse.quotas.map(convertApiQuotaToQuota);

    const loansResponse = await api.getUserLoans();
    const loans = loansResponse.loans.map(convertApiLoanToLoan);

    let systemBalance = 0;
    let profitPool = 0;
    
    if (currentUser.isAdmin) {
      try {
        const dashboard = await api.getAdminDashboard();
        systemBalance = dashboard.systemConfig.systemBalance;
        profitPool = dashboard.systemConfig.profitPool;
      } catch (error) {
        logger.error('Erro ao carregar dashboard administrativo:', error.message);
      }
    }

    return {
      currentUser,
      users: [currentUser],
      quotas,
      loans,
      transactions,
      systemBalance,
      profitPool,
    };
  } catch (error) {
    logger.error('Erro ao carregar estado da aplicação:', error.message);
    return {
      currentUser: null,
      users: [],
      quotas: [],
      loans: [],
      transactions: [],
      systemBalance: 0,
      profitPool: 0,
    };
  }
};

// Gerador de dados aleatórios
const generateRandomData = () => {
  const names = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Ferreira'];
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
  
  const name = names[Math.floor(Math.random() * names.length)];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const randomNum = Math.floor(Math.random() * 10000);
  
  return {
    name,
    email: `${name.toLowerCase().replace(' ', '.')}.${randomNum}@${domain}`,
    password: 'Senha123!',
    secretPhrase: `frase${randomNum}segura`,
    pixKey: `${Math.floor(Math.random() * 90000000000) + 10000000000}`,
    referralCode: null
  };
};

// Função principal de teste
const runIntegrationTest = async () => {
  logger.info('Iniciando teste de integração Frontend-Backend');
  logger.info(`URL da API: ${API_BASE_URL}`);
  
  const api = new ApiService();
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  const runTest = async (testName, testFunction) => {
    testResults.summary.total++;
    logger.info(`Executando teste: ${testName}`);
    
    try {
      const result = await testFunction();
      testResults.tests.push({
        name: testName,
        status: 'PASSED',
        result,
        timestamp: new Date().toISOString()
      });
      testResults.summary.passed++;
      logger.success(`✅ ${testName}`);
      return result;
    } catch (error) {
      testResults.tests.push({
        name: testName,
        status: 'FAILED',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      testResults.summary.failed++;
      logger.error(`❌ ${testName}: ${error.message}`);
      throw error;
    }
  };

  try {
    // Teste 1: Registro de usuário
    const userData = generateRandomData();
    const registerResult = await runTest('Registro de Usuário', async () => {
      return await api.register(
        userData.name,
        userData.email,
        userData.password,
        userData.secretPhrase,
        userData.pixKey,
        userData.referralCode
      );
    });

    // Teste 2: Carregar estado do usuário
    const userState = await runTest('Carregar Estado do Usuário', async () => {
      return await loadState(api);
    });

    // Teste 3: Obter perfil do usuário
    const userProfile = await runTest('Obter Perfil do Usuário', async () => {
      return await api.getUserProfile();
    });

    // Teste 4: Obter saldo do usuário
    const userBalance = await runTest('Obter Saldo do Usuário', async () => {
      return await api.getUserBalance();
    });

    // Teste 5: Comprar cota usando saldo (se tiver saldo suficiente)
    if (userBalance.balance >= QUOTA_PRICE) {
      await runTest('Comprar Cota (usando saldo)', async () => {
        return await api.buyQuotas(1, true);
      });
    } else {
      await runTest('Comprar Cota (via PIX)', async () => {
        return await api.buyQuotas(1, false);
      });
    }

    // Teste 6: Obter cotas do usuário
    const userQuotas = await runTest('Obter Cotas do Usuário', async () => {
      return await api.getUserQuotas();
    });

    // Teste 7: Solicitar empréstimo
    await runTest('Solicitar Empréstimo', async () => {
      return await api.requestLoan(
        100,
        3,
        userData.pixKey
      );
    });

    // Teste 8: Obter empréstimos do usuário
    const userLoans = await runTest('Obter Empréstimos do Usuário', async () => {
      return await api.getUserLoans();
    });

    // Teste 9: Obter transações do usuário
    const userTransactions = await runTest('Obter Transações do Usuário', async () => {
      return await api.getUserTransactions();
    });

    // Teste 10: Solicitar saque (se tiver saldo)
    if (userBalance.balance > 10) {
      await runTest('Solicitar Saque', async () => {
        return await api.requestWithdrawal(
          Math.min(10, userBalance.balance),
          userData.pixKey
        );
      });
    }

    // Teste 11: Vender cota (se tiver cotas)
    if (userQuotas.quotas && userQuotas.quotas.length > 0) {
      await runTest('Vender Cota', async () => {
        return await api.sellQuota(userQuotas.quotas[0].id);
      });
    }

    // Teste 12: Login com usuário existente
    await runTest('Login com Usuário Existente', async () => {
      return await api.login(
        userData.email,
        userData.password,
        userData.secretPhrase
      );
    });

    // Testes administrativos (se for admin)
    if (registerResult.user.isAdmin) {
      logger.info('Usuário é administrador, executando testes admin...');
      
      // Teste 13: Obter dashboard admin
      await runTest('Obter Dashboard Admin', async () => {
        return await api.getAdminDashboard();
      });

      // Teste 14: Atualizar caixa operacional
      await runTest('Atualizar Caixa Operacional', async () => {
        return await api.updateSystemBalance(10000);
      });

      // Teste 15: Adicionar lucro ao pool
      await runTest('Adicionar Lucro ao Pool', async () => {
        return await api.addProfitToPool(500);
      });

      // Teste 16: Processar ação admin (se houver itens pendentes)
      const dashboard = await api.getAdminDashboard();
      if (dashboard.pendingTransactions && dashboard.pendingTransactions.length > 0) {
        await runTest('Processar Ação Admin (Transação)', async () => {
          return await api.processAdminAction(
            dashboard.pendingTransactions[0].id,
            'TRANSACTION',
            'APPROVE'
          );
        });
      }
    }

    // Salvar resultados
    const reportPath = `frontend-backend-integration-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    
    logger.success('Teste de integração concluído com sucesso!');
    logger.info(`Relatório salvo em: ${reportPath}`);
    
    console.log('\n' + colors.bright + colors.cyan + '=== RESUMO DOS TESTES ===' + colors.reset);
    console.log(`Total: ${testResults.summary.total}`);
    console.log(`Passaram: ${colors.green}${testResults.summary.passed}${colors.reset}`);
    console.log(`Falharam: ${colors.red}${testResults.summary.failed}${colors.reset}`);
    console.log(`Taxa de sucesso: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
    
    return testResults;
    
  } catch (error) {
    logger.error('Erro durante execução dos testes:', error.message);
    
    // Salvar resultados parciais
    const reportPath = `frontend-backend-integration-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    logger.info(`Relatório parcial salvo em: ${reportPath}`);
    
    throw error;
  }
};

// Função para testar fluxo específico
const testSpecificFlow = async (flowName) => {
  const api = new ApiService();
  
  switch (flowName) {
    case 'complete-user-flow':
      await testCompleteUserFlow(api);
      break;
    case 'admin-flow':
      await testAdminFlow(api);
      break;
    case 'investment-flow':
      await testInvestmentFlow(api);
      break;
    case 'loan-flow':
      await testLoanFlow(api);
      break;
    default:
      logger.error('Fluxo não reconhecido:', flowName);
      logger.info('Fluxos disponíveis: complete-user-flow, admin-flow, investment-flow, loan-flow');
  }
};

const testCompleteUserFlow = async (api) => {
  logger.info('Testando fluxo completo do usuário...');
  
  // Registrar novo usuário
  const userData = generateRandomData();
  await api.register(
    userData.name,
    userData.email,
    userData.password,
    userData.secretPhrase,
    userData.pixKey
  );
  
  // Comprar cota
  await api.buyQuotas(1, false);
  
  // Solicitar empréstimo
  await api.requestLoan(100, 3, userData.pixKey);
  
  // Obter estado final
  const finalState = await loadState(api);
  
  logger.success('Fluxo completo do usuário finalizado');
  logger.info('Estado final:', finalState);
};

const testAdminFlow = async (api) => {
  logger.info('Testando fluxo administrativo...');
  
  // Login como admin (usando credenciais hardcoded do backend)
  await api.login('admin@cred30.com', 'admin123', 'admin');
  
  // Obter dashboard
  const dashboard = await api.getAdminDashboard();
  
  // Atualizar caixa
  await api.updateSystemBalance(10000);
  
  // Adicionar lucro
  await api.addProfitToPool(500);
  
  // Tentar distribuir dividendos se houver lucro
  try {
    await api.distributeDividends();
    logger.info('Dividendos distribuídos com sucesso');
  } catch (error) {
    logger.info('Não foi possível distribuir dividendos (pode não haver lucro suficiente)');
  }
  
  // Processar itens pendentes se houver
  if (dashboard.pendingTransactions && dashboard.pendingTransactions.length > 0) {
    logger.info('Processando transação pendente...');
    logger.info('Dados da transação:', dashboard.pendingTransactions[0]);
    logger.info('ID da transação (tipo):', typeof dashboard.pendingTransactions[0].id);
    try {
      await api.processAdminAction(
        String(dashboard.pendingTransactions[0].id),
        'TRANSACTION',
        'APPROVE'
      );
      logger.info('Transação processada com sucesso');
    } catch (error) {
      logger.error('Erro ao processar transação:', error.message);
    }
  } else {
    logger.info('Nenhuma transação pendente para processar');
  }
  
  // Processar empréstimos pendentes se houver
  if (dashboard.pendingLoans && dashboard.pendingLoans.length > 0) {
    logger.info('Processando empréstimo pendente...');
    try {
      await api.processAdminAction(
        dashboard.pendingLoans[0].id,
        'LOAN',
        'APPROVE'
      );
      logger.info('Empréstimo processado com sucesso');
    } catch (error) {
      logger.error('Erro ao processar empréstimo:', error.message);
    }
  } else {
    logger.info('Nenhum empréstimo pendente para processar');
  }
  
  logger.success('Fluxo administrativo finalizado');
};

const testInvestmentFlow = async (api) => {
  logger.info('Testando fluxo de investimento...');
  
  // Registrar usuário
  const userData = generateRandomData();
  await api.register(
    userData.name,
    userData.email,
    userData.password,
    userData.secretPhrase,
    userData.pixKey
  );
  
  // Comprar múltiplas cotas
  await api.buyQuotas(3, false);
  
  // Obter cotas
  const quotas = await api.getUserQuotas();
  
  // Vender uma cota
  if (quotas.quotas.length > 0) {
    await api.sellQuota(quotas.quotas[0].id);
  }
  
  logger.success('Fluxo de investimento finalizado');
};

const testLoanFlow = async (api) => {
  logger.info('Testando fluxo de empréstimo...');
  
  // Registrar usuário
  const userData = generateRandomData();
  await api.register(
    userData.name,
    userData.email,
    userData.password,
    userData.secretPhrase,
    userData.pixKey
  );
  
  // Solicitar empréstimo
  await api.requestLoan(200, 6, userData.pixKey);
  
  // Obter empréstimos
  const loans = await api.getUserLoans();
  
  // Pagar empréstimo se aprovado
  if (loans.loans.length > 0 && loans.loans[0].status === 'APPROVED') {
    await api.repayLoan(loans.loans[0].id, false);
  }
  
  logger.success('Fluxo de empréstimo finalizado');
};

// Execução principal
const args = process.argv.slice(2);

if (args.length > 0) {
  const flowName = args[0];
  testSpecificFlow(flowName).catch(error => {
    logger.error('Erro ao executar fluxo específico:', error.message);
    process.exit(1);
  });
} else {
  runIntegrationTest().catch(error => {
    logger.error('Erro na execução dos testes:', error.message);
    process.exit(1);
  });
}

export {
  ApiService,
  runIntegrationTest,
  testSpecificFlow,
  loadState,
  generateRandomData
};