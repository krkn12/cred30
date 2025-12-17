export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  secretPhrase: string;
  pixKey: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  secretPhrase: string;
  pixKey: string;
  referralCode?: string;
  isAdmin?: boolean;
}

export interface UserRepositoryInterface {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByReferralCode(referralCode: string): Promise<User | null>;
  save(user: CreateUserDto): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(): Promise<User[]>;
  count(): Promise<number>;
}