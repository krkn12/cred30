import { BaseError } from './base.error';

export class ValidationError extends BaseError {
  public readonly errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}