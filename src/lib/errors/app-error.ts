export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, statusCode = 400, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Standardized API error response formatter.
 * Prevents internal stack trace leakage in production.
 */
export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        statusCode: error.statusCode,
        errors: error.errors,
      },
    };
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled Server Error:', error);

  return {
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : String(error),
      statusCode: 500,
    },
  };
}
