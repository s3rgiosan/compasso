import { ErrorCode } from '@compasso/shared';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }

  static badRequest(message: string, code: string = ErrorCode.VALIDATION_ERROR): AppError {
    return new AppError(message, code, 400);
  }

  static unauthorized(message: string, code: string = ErrorCode.AUTH_REQUIRED): AppError {
    return new AppError(message, code, 401);
  }

  static forbidden(message: string, code: string = ErrorCode.FORBIDDEN): AppError {
    return new AppError(message, code, 403);
  }

  static notFound(message: string, code: string = ErrorCode.NOT_FOUND): AppError {
    return new AppError(message, code, 404);
  }

  static conflict(message: string, code: string = ErrorCode.DUPLICATE_RESOURCE): AppError {
    return new AppError(message, code, 409);
  }

  static internal(message: string, code: string = ErrorCode.INTERNAL_ERROR): AppError {
    return new AppError(message, code, 500);
  }
}
