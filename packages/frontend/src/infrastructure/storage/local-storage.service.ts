
import { User, Quota, Loan, Transaction, AppState } from '../types';
import { QUOTA_PRICE, ONE_MONTH_MS, LOAN_INTEREST_RATE, PENALTY_RATE, VESTING_PERIOD_MS } from '../constants';

const STORAGE_KEY = 'cred30_db_v3'; // Bumped version for state migration

const generateId = () => Math.random().toString(36).substr(2, 9);
const generateReferralCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const getInitialState = (): AppState => ({
  currentUser: null,
  users: [],
  quotas: [],
  loans: [],
  transactions: [],
  systemBalance: 0, // Caixa operacional
  profitPool: 0 // Acumulo de juros
});

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Migration helper
    if (parsed.systemBalance === undefined) parsed.systemBalance = 0;
    if (parsed.profitPool === undefined) parsed.profitPool = 0;
    return parsed;
  }
  return getInitialState();
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// --- Admin Logic ---

export const updateSystemBalance = (newBalance: number) => {
  const state = loadState();
  if (!state.currentUser?.isAdmin) throw new Error("Acesso negado");
  if (isNaN(newBalance)) throw new Error("Valor inválido");
  state.systemBalance = newBalance;
  saveState(state);
};

export const updateProfitPool = (amountToAdd: number) => {
  const state = loadState();
  if (!state.currentUser?.isAdmin) throw new Error("Acesso negado");
  if (isNaN(amountToAdd)) throw new Error("Valor inválido");
  state.profitPool += amountToAdd; // SOMA ao valor existente
  saveState(state);
};

export const getPendingItems = () => {
  const state = loadState();
  if (!state.currentUser?.isAdmin) throw new Error("Acesso negado");

  const pendingTrans = state.transactions.filter(t => t.status === 'PENDING').map(t => ({...t, itemType: 'TRANSACTION'}));
  const pendingLoans = state.loans.filter(l => l.status === 'PENDING').map(l => ({...l, itemType: 'LOAN'}));

  return { transactions: pendingTrans, loans: pendingLoans };
};

export const processAdminAction = (itemId: string, itemType: 'TRANSACTION' | 'LOAN', action: 'APPROVE' | 'REJECT') => {
  const state = loadState();
  if (!state.currentUser?.isAdmin) throw new Error("Acesso negado");

  if (itemType === 'TRANSACTION') {
    const tIndex = state.transactions.findIndex(t => t.id === itemId);
    if (tIndex === -1) throw new Error("Item não encontrado");
    const trans = state.transactions[tIndex];

    if (action === 'REJECT') {
      trans.status = 'REJECTED';
      
      // CRITICAL FIX: Refund logic for rejected transactions
      
      // 1. If Withdrawal rejected, refund user
      if (trans.type === 'WITHDRAWAL') {
        const uIdx = state.users.findIndex(u => u.id === trans.userId);
        if (uIdx !== -1) state.users[uIdx].balance += trans.amount;
      }
      
      // 2. If Buy Quota rejected AND used balance, refund user
      if (trans.type === 'BUY_QUOTA' && trans.metadata?.useBalance) {
        const uIdx = state.users.findIndex(u => u.id === trans.userId);
        if (uIdx !== -1) state.users[uIdx].balance += trans.amount;
      }
      
      // 3. If Loan Payment rejected (e.g. wrong amount)
      if (trans.type === 'LOAN_PAYMENT') {
        const loanId = trans.metadata?.loanId;
        const loanIdx = state.loans.findIndex(l => l.id === loanId);
        if (loanIdx !== -1) {
            state.loans[loanIdx].status = 'APPROVED'; // Revert to active (unpaid)
        }
        // If paid with balance, refund user
        if (trans.metadata?.useBalance) {
             const uIdx = state.users.findIndex(u => u.id === trans.userId);
             if (uIdx !== -1) state.users[uIdx].balance += trans.amount;
        }
      }

    } else {
      // APPROVE
      trans.status = 'APPROVED';
      const uIdx = state.users.findIndex(u => u.id === trans.userId);
      
      if (trans.type === 'BUY_QUOTA') {
         // Create Quotas now
         const qty = trans.metadata?.quantity || 1;
         const newQuotas: Quota[] = [];
         for (let i = 0; i < qty; i++) {
           newQuotas.push({
             id: generateId(),
             userId: trans.userId,
             purchasePrice: QUOTA_PRICE,
             purchaseDate: Date.now(),
             currentValue: QUOTA_PRICE,
             yieldRate: 1.001
           });
         }
         state.quotas.push(...newQuotas);
         // Money enters Operational System Balance
         state.systemBalance += trans.amount;

      } else if (trans.type === 'WITHDRAWAL') {
         // Money logic: User balance was already deducted on request.
         // System balance (Operational Cash) is NOT affected by withdrawals as per user request.
         // state.systemBalance -= trans.amount; // REMOVED

      } else if (trans.type === 'LOAN_PAYMENT') {
        const loanId = trans.metadata?.loanId;
        const loanIdx = state.loans.findIndex(l => l.id === loanId);
        
        if (loanIdx !== -1) {
            const loan = state.loans[loanIdx];
            state.loans[loanIdx].status = 'PAID';
            
            // LOGIC SPLIT:
            // Principal amount returns to System Balance (Restocks the pool)
            // Interest amount goes to Profit Pool (To be distributed)
            const principal = loan.amount;
            const interest = loan.totalRepayment - principal;
            
            // Add Principal back to operational cash
            state.systemBalance += principal;
            
            // Add Interest to profit pool for dividends
            state.profitPool += interest;
        }
      }
    }
  } else if (itemType === 'LOAN') {
    const lIndex = state.loans.findIndex(l => l.id === itemId);
    if (lIndex === -1) throw new Error("Empréstimo não encontrado");
    const loan = state.loans[lIndex];

    if (action === 'REJECT') {
      loan.status = 'REJECTED';
    } else {
      loan.status = 'APPROVED';
      // Credit user balance
      const uIdx = state.users.findIndex(u => u.id === loan.userId);
      if (uIdx !== -1) {
        state.users[uIdx].balance += loan.amount;
        state.transactions.push({
          id: generateId(),
          userId: loan.userId,
          type: 'LOAN_RECEIVED',
          amount: loan.amount,
          date: Date.now(),
          description: `Empréstimo Aprovado`,
          status: 'APPROVED'
        });
      }
      // Money leaves System Balance (Loaned out)
      state.systemBalance -= loan.amount;
    }
  }

  saveState(state);
};

export const distributeMonthlyDividends = () => {
  const state = loadState();
  if (!state.currentUser?.isAdmin) throw new Error("Acesso negado");

  const totalQuotas = state.quotas.length;
  if (totalQuotas === 0) throw new Error("Não há cotas ativas para distribuir dividendos.");

  const profit = state.profitPool;
  if (profit <= 0) throw new Error("Não há lucros (juros) acumulados para distribuir.");

  // NEW RULE: 85% for Users, 15% for Project Maintenance
  const userSharePercentage = 0.85;
  
  const totalForUsers = profit * userSharePercentage;
  const totalForMaintenance = profit - totalForUsers;

  const dividendPerQuota = totalForUsers / totalQuotas;

  // Distribute 85% to users
  state.users.forEach(user => {
    const userQuotaCount = state.quotas.filter(q => q.userId === user.id).length;
    if (userQuotaCount > 0) {
      const userShare = userQuotaCount * dividendPerQuota;
      user.balance += userShare;
      
      state.transactions.push({
        id: generateId(),
        userId: user.id,
        type: 'DEPOSIT',
        amount: userShare,
        date: Date.now(),
        description: `Dividendos (85% do Lucro): R$ ${dividendPerQuota.toFixed(2)}/cota`,
        status: 'APPROVED'
      });
    }
  });

  // Transfer the remaining 15% to System Balance (Operational Cash / Maintenance)
  state.systemBalance += totalForMaintenance;

  // Reset Profit Pool
  state.profitPool = 0;

  saveState(state);
  
  return { 
    totalProfit: profit,
    distributed: totalForUsers, 
    maintenance: totalForMaintenance,
    perQuota: dividendPerQuota 
  };
};

// --- User Logic ---

export const buyQuota = (quantity: number, useBalance: boolean = false) => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");

  const cost = quantity * QUOTA_PRICE;

  if (useBalance) {
    const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
    if (userIndex === -1) throw new Error("Erro de usuário");
    
    if (state.users[userIndex].balance < cost) {
      throw new Error(`Saldo insuficiente. Necessário R$ ${cost.toFixed(2)}`);
    }
    // Deduct immediately if using balance
    state.users[userIndex].balance -= cost;
    state.currentUser = state.users[userIndex];
  }

  // Create PENDING transaction
  state.transactions.push({
    id: generateId(),
    userId: state.currentUser.id,
    type: 'BUY_QUOTA',
    amount: cost,
    date: Date.now(),
    description: `Compra de ${quantity} cota(s) - Aguardando Aprovação`,
    status: 'PENDING',
    metadata: { quantity, useBalance }
  });

  saveState(state);
};

export const sellQuota = (quotaId: string) => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");

  // RULE: Cannot sell if there are active loans
  const hasActiveLoans = state.loans.some(l => 
    l.userId === state.currentUser?.id && 
    (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING')
  );

  if (hasActiveLoans) {
    throw new Error("Operação bloqueada: Você possui empréstimos em aberto. Quite seus débitos antes de vender cotas.");
  }

  const quotaIndex = state.quotas.findIndex(q => q.id === quotaId);
  if (quotaIndex === -1) throw new Error("Cota não encontrada");

  const quota = state.quotas[quotaIndex];
  const now = Date.now();
  const timeDiff = now - quota.purchaseDate;
  const isEarlyExit = timeDiff < VESTING_PERIOD_MS;

  let finalAmount = quota.purchasePrice;
  let penaltyAmount = 0;

  if (isEarlyExit) {
    penaltyAmount = quota.purchasePrice * PENALTY_RATE;
    finalAmount = finalAmount - penaltyAmount;
  }

  state.quotas.splice(quotaIndex, 1);

  const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
  if (userIndex !== -1) {
    state.users[userIndex].balance += finalAmount;
    state.currentUser = state.users[userIndex];
  }

  state.transactions.push({
    id: generateId(),
    userId: state.currentUser.id,
    type: 'SELL_QUOTA',
    amount: finalAmount,
    date: Date.now(),
    description: `Resgate de cota ${isEarlyExit ? '(Multa 40%)' : '(Integral)'}`,
    status: 'APPROVED' // DIRECT APPROVAL (NO ADMIN)
  });
  
  // When system buys back quota, money leaves system balance
  state.systemBalance -= finalAmount;

  // NEW RULE: If there was a penalty, that money moves from System Balance (retained) to Profit Pool
  if (penaltyAmount > 0) {
      state.profitPool += penaltyAmount;
      state.systemBalance -= penaltyAmount;
  }

  saveState(state);
};

export const sellAllQuotas = (): number => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");

  // RULE: Cannot sell if there are active loans
  const hasActiveLoans = state.loans.some(l => 
    l.userId === state.currentUser?.id && 
    (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PAYMENT_PENDING')
  );

  if (hasActiveLoans) {
    throw new Error("Operação bloqueada: Você possui empréstimos em aberto. Quite seus débitos antes de vender cotas.");
  }

  const userQuotas = state.quotas.filter(q => q.userId === state.currentUser?.id);
  if (userQuotas.length === 0) return 0;

  let totalReceived = 0;
  let totalPenalty = 0;

  for (let i = state.quotas.length - 1; i >= 0; i--) {
    const q = state.quotas[i];
    if (q.userId === state.currentUser.id) {
        const timeDiff = Date.now() - q.purchaseDate;
        const isEarlyExit = timeDiff < VESTING_PERIOD_MS;
        
        let amount = q.purchasePrice;
        let penalty = 0;

        if (isEarlyExit) {
            penalty = q.purchasePrice * PENALTY_RATE;
            amount = amount - penalty;
            totalPenalty += penalty;
        }
        
        totalReceived += amount;
        state.quotas.splice(i, 1);
    }
  }

  const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
  if (userIndex !== -1) {
    state.users[userIndex].balance += totalReceived;
    state.currentUser = state.users[userIndex];
  }

  state.transactions.push({
    id: generateId(),
    userId: state.currentUser.id,
    type: 'SELL_QUOTA',
    amount: totalReceived,
    date: Date.now(),
    description: `Resgate total de cotas`,
    status: 'APPROVED' // DIRECT APPROVAL (NO ADMIN)
  });

  state.systemBalance -= totalReceived;

  // NEW RULE: If there was a penalty, that money moves from System Balance (retained) to Profit Pool
  if (totalPenalty > 0) {
      state.profitPool += totalPenalty;
      state.systemBalance -= totalPenalty;
  }

  saveState(state);
  return totalReceived;
};

export const requestLoan = (amount: number, installments: number, receivePixKey: string) => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");

  const totalWithInterest = amount * (1 + (LOAN_INTEREST_RATE * installments));

  const loan: Loan = {
    id: generateId(),
    userId: state.currentUser.id,
    amount,
    totalRepayment: totalWithInterest,
    installments,
    interestRate: LOAN_INTEREST_RATE,
    requestDate: Date.now(),
    dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000), 
    status: 'PENDING',
    pixKeyToReceive: receivePixKey
  };

  state.loans.push(loan);
  saveState(state);
  return loan;
};

export const repayLoan = (loanId: string, useBalance: boolean) => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");

  const loanIndex = state.loans.findIndex(l => l.id === loanId);
  if (loanIndex === -1) throw new Error("Empréstimo não encontrado");

  const loan = state.loans[loanIndex];
  if (loan.status !== 'APPROVED') throw new Error("Empréstimo não está ativo para pagamento");

  if (useBalance) {
    const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
    if (userIndex === -1) throw new Error("Erro de usuário");

    if (state.users[userIndex].balance < loan.totalRepayment) {
      throw new Error("Saldo insuficiente.");
    }
    state.users[userIndex].balance -= loan.totalRepayment;
    state.currentUser = state.users[userIndex];
  }

  state.loans[loanIndex].status = 'PAYMENT_PENDING';

  state.transactions.push({
    id: generateId(),
    userId: state.currentUser.id,
    type: 'LOAN_PAYMENT',
    amount: loan.totalRepayment,
    date: Date.now(),
    description: `Pagamento de empréstimo (${useBalance ? 'Saldo' : 'PIX Externo'}) - Aguardando Confirmação`,
    status: 'PENDING',
    metadata: { loanId, useBalance }
  });

  saveState(state);
};

export const requestWithdrawal = (amount: number, pixKey: string) => {
  const state = loadState();
  if (!state.currentUser) throw new Error("Usuário não logado");
  
  const userIndex = state.users.findIndex(u => u.id === state.currentUser?.id);
  if (userIndex === -1) throw new Error("Usuário inválido");

  const user = state.users[userIndex];

  if (amount <= 0) throw new Error("Valor deve ser maior que zero.");
  if (user.balance < amount) throw new Error("Saldo insuficiente.");

  state.users[userIndex].balance -= amount;
  state.currentUser = state.users[userIndex];

  state.transactions.push({
    id: generateId(),
    userId: state.currentUser.id,
    type: 'WITHDRAWAL',
    amount: amount,
    date: Date.now(),
    description: `Solicitação de Saque (${pixKey})`,
    status: 'PENDING'
  });

  saveState(state);
};

export const fastForwardTime = (months: number) => {
  const state = loadState();
  const jump = months * ONE_MONTH_MS;
  
  state.quotas = state.quotas.map(q => ({
    ...q,
    purchaseDate: q.purchaseDate - jump
  }));

  state.loans = state.loans.map(l => ({
    ...l,
    requestDate: l.requestDate - jump
  }));

  if (state.currentUser) {
     state.currentUser.joinedAt -= jump;
     const uIdx = state.users.findIndex(u => u.id === state.currentUser?.id);
     if (uIdx !== -1) state.users[uIdx] = state.currentUser;
  }

  saveState(state);
};

// --- Auth ---

export const registerUser = (name: string, email: string, password: string, pixKey: string, secretPhrase: string, referralCodeInput?: string): User => {
  const state = loadState();
  if (state.users.find(u => u.email === email)) {
    throw new Error("Email já cadastrado.");
  }

  if (referralCodeInput) {
    const referrerIndex = state.users.findIndex(u => u.referralCode === referralCodeInput.toUpperCase());
    if (referrerIndex !== -1) {
      const bonus = 5.00;
      state.users[referrerIndex].balance += bonus;
      state.systemBalance -= bonus; // Marketing cost
      state.transactions.push({
         id: generateId(),
         userId: state.users[referrerIndex].id,
         type: 'REFERRAL_BONUS',
         amount: bonus,
         date: Date.now(),
         description: `Bônus indicação: ${name}`,
         status: 'APPROVED'
      });
    }
  }

  const newUser: User = {
    id: generateId(),
    name,
    email,
    password, 
    secretPhrase,
    pixKey,
    balance: 0,
    joinedAt: Date.now(),
    referralCode: generateReferralCode(),
    isAdmin: false
  };
  state.users.push(newUser);
  state.currentUser = newUser;
  saveState(state);
  return newUser;
};

export const loginUser = (email: string, password: string, secretPhrase: string): User => {
  // Hardcoded Admin Login
  if (email === 'admin@cred30.com' && password === 'admin123' && secretPhrase === 'admin') {
     const adminUser: User = {
       id: 'ADMIN',
       name: 'Administrador',
       email: 'admin@cred30.com',
       secretPhrase: 'admin',
       pixKey: '',
       balance: 0,
       joinedAt: Date.now(),
       referralCode: 'ADMIN',
       isAdmin: true
     };
     const state = loadState();
     state.currentUser = adminUser;
     saveState(state);
     return adminUser;
  }

  const state = loadState();
  const user = state.users.find(u => u.email === email);
  
  if (!user) throw new Error("Usuário não encontrado.");
  if (user.password && user.password !== password) throw new Error("Senha incorreta.");
  if (user.secretPhrase !== secretPhrase) throw new Error("Frase secreta incorreta.");

  state.currentUser = user;
  saveState(state);
  return user;
};

export const resetPassword = (email: string, secretPhrase: string, newPassword: string) => {
  const state = loadState();
  const userIndex = state.users.findIndex(u => u.email === email);
  if (userIndex === -1) throw new Error("Email não encontrado.");
  const user = state.users[userIndex];
  if (user.secretPhrase !== secretPhrase) throw new Error("Frase secreta incorreta.");
  state.users[userIndex].password = newPassword;
  saveState(state);
};

export const logoutUser = () => {
  const state = loadState();
  state.currentUser = null;
  saveState(state);
};

export const getCurrentUser = (): User | null => {
  return loadState().currentUser;
};
