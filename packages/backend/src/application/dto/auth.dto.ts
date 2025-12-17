import { z } from 'zod';

export interface LoginDto {
  email: string;
  password: string;
  secretPhrase: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  secretPhrase: string;
  pixKey: string;
  referralCode?: string;
}

export interface ResetPasswordDto {
  email: string;
  secretPhrase: string;
  newPassword: string;
}

export interface AuthResponseDto {
  user: {
    id: string;
    name: string;
    email: string;
    pixKey: string;
    balance: number;
    joinedAt: string;
    referralCode: string;
    isAdmin: boolean;
  };
  token: string;
  isFirstUser?: boolean;
}

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  secretPhrase: z.string().min(3, 'Frase secreta deve ter no mínimo 3 caracteres'),
});

export const registerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  secretPhrase: z.string().min(3, 'Frase secreta deve ter no mínimo 3 caracteres'),
  pixKey: z.string().min(5, 'Chave PIX deve ter no mínimo 5 caracteres'),
  referralCode: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  secretPhrase: z.string().min(3, 'Frase secreta deve ter no mínimo 3 caracteres'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});