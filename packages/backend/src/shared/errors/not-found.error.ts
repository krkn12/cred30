import { BaseError } from './base.error';

export class NotFoundError extends BaseError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404);
  }
}