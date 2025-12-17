import { ObjectId } from 'mongodb';
import { User } from './User';
import { Quota } from './Quota';
import { Loan } from './Loan';
import { Transaction } from './Transaction';

export interface AppState {
  currentUser: User | null;
  users: User[];
  quotas: Quota[];
  loans: Loan[];
  transactions: Transaction[];
  systemBalance: number; // Caixa Operacional (Depósitos, Capital de Giro)
  profitPool: number; // Caixa de Lucros (Juros recebidos de empréstimos)
}

export interface SystemConfig {
  systemBalance: number;
  profitPool: number;
  quotaPrice: number;
  loanInterestRate: number;
  penaltyRate: number;
  vestingPeriodMs: number;
}

export interface AdminDashboard {
  pendingTransactions: Transaction[];
  pendingLoans: Loan[];
  systemConfig: SystemConfig;
}