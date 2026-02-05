export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BookingError extends AppError {
  constructor(message: string, statusCode = 400, errorCode = "BOOKING_ERROR") {
    super(message, statusCode, errorCode);
  }
}

export class AuthError extends AppError {
  constructor(message: string, statusCode = 401, errorCode = "AUTH_ERROR") {
    super(message, statusCode, errorCode);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    statusCode = 400,
    errorCode = "VALIDATION_ERROR",
  ) {
    super(message, statusCode, errorCode);
  }
}
