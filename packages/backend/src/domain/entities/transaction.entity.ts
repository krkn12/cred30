import { ObjectId } from 'mongodb';

export interface Transaction {
  _id?: ObjectId;
  id?: string;
  userId: string | ObjectId;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BUY_QUOTA' | 'SELL_QUOTA' | 'LOAN_RECEIVED' | 'LOAN_PAYMENT' | 'REFERRAL_BONUS';
  amount: number;
  date: number;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  metadata?: any;
}

export interface CreateTransactionRequest {
  type: Transaction['type'];
  amount: number;
  description?: string;
  metadata?: any;
}

export interface UpdateTransactionStatusRequest {
  transactionId: string;
  status: 'APPROVED' | 'REJECTED';
}