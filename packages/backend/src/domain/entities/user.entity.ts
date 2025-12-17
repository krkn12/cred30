export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  secretPhrase: string;
  pixKey: string;
  balance: number;
  created_at?: Date;
  referral_code?: string;
  is_admin?: boolean;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  secretPhrase: string;
  pixKey: string;
  referralCode?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  secretPhrase: string;
}

export interface UpdateUserRequest {
  name?: string;
  pixKey?: string;
  secretPhrase?: string;
}