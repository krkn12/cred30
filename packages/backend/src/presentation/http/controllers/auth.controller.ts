import { Hono } from 'hono';
import { z } from 'zod';
import { AuthenticateUseCase } from '../../../application/use-cases/auth/authenticate.use-case';
import { RegisterUseCase } from '../../../application/use-cases/auth/register.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/auth/reset-password.use-case';
import { AuthDto } from '../../../application/dto/auth.dto';
import { AuthValidator } from '../../../application/validators/auth.validator';
import { BaseController } from './base.controller';

export class AuthController extends BaseController {
  constructor(
    private readonly authenticateUseCase: AuthenticateUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly authValidator: AuthValidator
  ) {
    super();
  }

  async login(c: any) {
    try {
      const body = await c.req.json();
      const validatedData = this.authValidator.validateLogin(body);
      
      const result = await this.authenticateUseCase.execute(validatedData);
      
      return c.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: result,
      });
    } catch (error: any) {
      return this.handleError(c, error);
    }
  }

  async register(c: any) {
    try {
      const body = await c.req.json();
      const validatedData = this.authValidator.validateRegister(body);
      
      const result = await this.registerUseCase.execute(validatedData);
      
      return c.json({
        success: true,
        message: result.isFirstUser 
          ? 'Usuário criado com sucesso! Você foi definido como o primeiro administrador do sistema.'
          : 'Usuário criado com sucesso',
        data: result,
      }, 201);
    } catch (error: any) {
      return this.handleError(c, error);
    }
  }

  async resetPassword(c: any) {
    try {
      const body = await c.req.json();
      const validatedData = this.authValidator.validateResetPassword(body);
      
      await this.resetPasswordUseCase.execute(validatedData);
      
      return c.json({
        success: true,
        message: 'Senha redefinida com sucesso',
      });
    } catch (error: any) {
      return this.handleError(c, error);
    }
  }

  async logout(c: any) {
    try {
      // Lógica de logout será implementada no use case
      return c.json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error: any) {
      return this.handleError(c, error);
    }
  }
}