export interface Quota {
  id: string | number;
  userId: string | number;
  purchasePrice: number;
  purchaseDate: number | Date;
  currentValue: number;
  status: 'ACTIVE' | 'SOLD' | 'REDEEMED' | 'LIQUIDATED';
}

export interface CreateQuotaRequest {
  quantity: number;
  useBalance: boolean;
}

export interface SellQuotaRequest {
  quotaId: string;
}