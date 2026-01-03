export interface Transaction {
  id: string | number;
  userId: string | number;
  type: string;
  amount: number;
  gateway_cost?: number;
  created_at?: Date;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'CANCELLED';
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