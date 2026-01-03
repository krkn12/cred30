export interface Loan {
  id: string | number;
  userId: string | number;
  amount: number;
  totalRepayment: number;
  installments: number;
  interestRate: number;
  requestDate?: number;
  created_at?: Date;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'DEFAULTED' | 'REJECTED' | 'PAYMENT_PENDING' | 'OVERDUE' | 'CANCELLED';
  pixKeyToReceive?: string;
  dueDate?: number | Date;
}

export interface CreateLoanRequest {
  amount: number;
  installments: number;
  receivePixKey: string;
}

export interface RepayLoanRequest {
  loanId: string;
  useBalance: boolean;
}