import { z } from 'zod';
import { ValidationError } from '../../../shared/errors/validation.error';
import { LoginDto, RegisterDto, ResetPasswordDto, loginSchema, registerSchema, resetPasswordSchema } from '../dto/auth.dto';

export class AuthValidator {
  validateLogin(data: any): LoginDto {
    try {
      return loginSchema.parse(data);
    } catch (error: any) {
      if (error.errors) {
        throw new ValidationError('Dados de login inválidos', error.errors);
      }
      throw new ValidationError('Dados de login inválidos');
    }
  }

  validateRegister(data: any): RegisterDto {
    try {
      return registerSchema.parse(data);
    } catch (error: any) {
      if (error.errors) {
        throw new ValidationError('Dados de registro inválidos', error.errors);
      }
      throw new ValidationError('Dados de registro inválidos');
    }
  }

  validateResetPassword(data: any): ResetPasswordDto {
    try {
      return resetPasswordSchema.parse(data);
    } catch (error: any) {
      if (error.errors) {
        throw new ValidationError('Dados de redefinição de senha inválidos', error.errors);
      }
      throw new ValidationError('Dados de redefinição de senha inválidos');
    }
  }
}