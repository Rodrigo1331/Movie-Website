export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found`);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'conflict', message, details);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'validation_error', message, details);
