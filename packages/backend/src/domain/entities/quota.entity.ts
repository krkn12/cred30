import { ObjectId } from 'mongodb';

export interface Quota {
  _id?: ObjectId;
  id?: string;
  userId: string | ObjectId;
  purchasePrice: number;
  purchaseDate: number;
  currentValue: number;
  yieldRate: number;
}

export interface CreateQuotaRequest {
  quantity: number;
  useBalance: boolean;
}

export interface SellQuotaRequest {
  quotaId: string;
}