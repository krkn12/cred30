import { Context } from 'hono';
import { ValidationError } from '../../../shared/errors/validation.error';
import { NotFoundError } from '../../../shared/errors/not-found.error';
import { UnauthorizedError } from '../../../shared/errors/unauthorized.error';
import { ConflictError } from '../../../shared/errors/conflict.error';

export abstract class BaseController {
  protected handleError(c: Context, error: any) {
    console.error('Controller Error:', error);

    if (error instanceof ValidationError) {
      return c.json({
        success: false,
        message: 'Dados inválidos',
        errors: error.errors,
      }, 400);
    }

    if (error instanceof NotFoundError) {
      return c.json({
        success: false,
        message: error.message,
      }, 404);
    }

    if (error instanceof UnauthorizedError) {
      return c.json({
        success: false,
        message: error.message,
      }, 401);
    }

    if (error instanceof ConflictError) {
      return c.json({
        success: false,
        message: error.message,
      }, 409);
    }

    // Erro genérico
    return c.json({
      success: false,
      message: 'Erro interno do servidor',
    }, 500);
  }

  protected success<T>(c: Context, data: T, message: string = 'Operação realizada com sucesso') {
    return c.json({
      success: true,
      message,
      data,
    });
  }

  protected created<T>(c: Context, data: T, message: string = 'Recurso criado com sucesso') {
    return c.json({
      success: true,
      message,
      data,
    }, 201);
  }

  protected noContent(c: Context) {
    return c.newResponse(null, 204);
  }
}