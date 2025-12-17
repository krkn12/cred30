import { ObjectId } from 'mongodb';

export interface Loan {
  _id?: ObjectId;
  id?: string;
  userId: string | ObjectId;
  amount: number;
  totalRepayment: number;
  installments: number;
  interestRate: number;
  requestDate: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'DEFAULTED' | 'REJECTED' | 'PAYMENT_PENDING';
  pixKeyToReceive: string;
  dueDate: number;
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