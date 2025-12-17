// Script para testar o fluxo administrativo completo
// Este script simula exatamente as operações que o frontend realiza

import fs from 'fs';

const API_BASE_URL = 'http://localhost:3001/api';

class AdminFlowTester {
  constructor() {
    this.adminToken = null;
    this.userToken = null;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };

    console.log(`🔵 Requisição: ${options.method || 'GET'} ${url}`);
    if (config.body) {
      console.log(`📤 Corpo:`, JSON.parse(config.body));
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      console.log(`📥 Resposta (${response.status}):`, data);
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Erro na requisição:`, error.message);
      throw error;
    }
  }

  async login(email, password, secretPhrase) {
    console.log('\n🔐 Fazendo login administrativo...');
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secretPhrase })
    });
    
    this.adminToken = response.data.token;
    console.log('✅ Login administrativo realizado com sucesso');
    return response.data.user;
  }

  async getDashboard() {
    console.log('\n📊 Carregando dashboard administrativo...');
    const response = await this.request('/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      }
    });
    return response.data;
  }

  async updateSystemBalance(newBalance) {
    console.log('\n💰 Atualizando saldo do sistema...');
    const response = await this.request('/admin/system-balance', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ newBalance })
    });
    console.log('✅ Saldo do sistema atualizado');
    return response;
  }

  async addProfitToPool(amount) {
    console.log('\n💵 Adicionando lucro ao pool...');
    const response = await this.request('/admin/profit-pool', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      },
      body: JSON.stringify({ amountToAdd: amount })
    });
    console.log('✅ Lucro adicionado ao pool');
    return response;
  }

  async processAction(id, type, action) {
    console.log(`\n⚙️ Processando ação: ${action} ${type} ID ${id}...`);
    
    // Enviando exatamente como o frontend envia
    const requestBody = JSON.stringify({ id, type, action });
    console.log('📤 Corpo da requisição:', requestBody);
    
    const response = await this.request('/admin/process-action', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      },
      body: requestBody
    });
    console.log(`✅ Ação ${action} processada com sucesso`);
    return response;
  }

  async distributeDividends() {
    console.log('\n💰 Distribuindo dividendos...');
    const response = await this.request('/admin/distribute-dividends', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.adminToken}`
      }
    });
    console.log('✅ Dividendos distribuídos com sucesso');
    return response;
  }

  async registerUser(name, email, password, secretPhrase, pixKey, referralCode) {
    console.log('\n👤 Registrando usuário de teste...');
    const requestBody = { name, email, password, secretPhrase, pixKey };
    if (referralCode && referralCode.trim() !== '') {
      requestBody.referralCode = referralCode;
    }
    
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    this.userToken = response.data.token;
    console.log('✅ Usuário registrado com sucesso');
    return response.data.user;
  }

  async buyQuotas(quantity, useBalance) {
    console.log(`\n📈 Comprando ${quantity} cota(s)...`);
    const response = await this.request('/quotas/buy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.userToken}`
      },
      body: JSON.stringify({ quantity, useBalance })
    });
    console.log('✅ Compra de cotas solicitada');
    return response;
  }

  async requestLoan(amount, installments, receivePixKey) {
    console.log(`\n💳 Solicitando empréstimo de R$ ${amount}...`);
    const response = await this.request('/loans/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.userToken}`
      },
      body: JSON.stringify({ amount, installments, receivePixKey })
    });
    console.log('✅ Empréstimo solicitado');
    return response;
  }

  async runFullTest() {
    try {
      console.log('🚀 Iniciando teste completo do fluxo administrativo...\n');

      // 1. Login administrativo
      const admin = await this.login('admin@cred30.com', 'admin123', 'admin123');
      
      // 2. Registrar usuário de teste
      const randomSuffix = Math.floor(Math.random() * 1000);
      const user = await this.registerUser(
        `Usuário Teste ${randomSuffix}`,
        `teste${randomSuffix}@email.com`,
        '123456',
        'secret123',
        '12345678901',
        ''
      );

      // 3. Comprar cotas (para gerar transação pendente)
      await this.buyQuotas(2, false);
      
      // 4. Solicitar empréstimo (para gerar empréstimo pendente)
      await this.requestLoan(500, 3, 'pix@teste.com');

      // 5. Carregar dashboard
      const dashboard = await this.getDashboard();
      console.log('\n📊 Dashboard carregado:');
      console.log(`- Transações pendentes: ${dashboard.pendingTransactions.length}`);
      console.log(`- Empréstimos pendentes: ${dashboard.pendingLoans.length}`);

      // 6. Atualizar saldo do sistema
      await this.updateSystemBalance(10000);

      // 7. Adicionar lucro ao pool
      await this.addProfitToPool(500);

      // 8. Processar ações (se houver itens pendentes)
      if (dashboard.pendingTransactions.length > 0) {
        const transaction = dashboard.pendingTransactions[0];
        await this.processAction(transaction.id, 'TRANSACTION', 'APPROVE');
      }

      if (dashboard.pendingLoans.length > 0) {
        const loan = dashboard.pendingLoans[0];
        await this.processAction(loan.id, 'LOAN', 'APPROVE');
      }

      // 9. Distribuir dividendos
      await this.distributeDividends();

      console.log('\n🎉 Teste completo finalizado com sucesso!');
      
      // Salvar resultado
      const result = {
        timestamp: new Date().toISOString(),
        success: true,
        admin: admin,
        user: user,
        dashboard: dashboard,
        operations: [
          'Login administrativo',
          'Registro de usuário',
          'Compra de cotas',
          'Solicitação de empréstimo',
          'Carregamento de dashboard',
          'Atualização de saldo do sistema',
          'Adição de lucro ao pool',
          'Processamento de ações',
          'Distribuição de dividendos'
        ]
      };

      fs.writeFileSync(
        `admin-flow-test-${Date.now()}.json`,
        JSON.stringify(result, null, 2)
      );

      console.log('📄 Resultado salvo em arquivo JSON');

    } catch (error) {
      console.error('\n❌ Erro durante o teste:', error.message);
      
      // Salvar erro
      const errorResult = {
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        stack: error.stack
      };

      fs.writeFileSync(
        `admin-flow-error-${Date.now()}.json`,
        JSON.stringify(errorResult, null, 2)
      );

      process.exit(1);
    }
  }
}

// Executar teste
const tester = new AdminFlowTester();
tester.runFullTest();