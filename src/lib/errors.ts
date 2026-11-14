export type ErrorCode =
  | 'GPX_EMPTY_FILE'
  | 'GPX_TOO_LARGE'
  | 'GPX_INVALID_XML'
  | 'GPX_NOT_GPX'
  | 'GPX_NO_POINTS'
  | 'GPX_TOO_FEW_POINTS'
  | 'GPX_BAD_COORDS'
  | 'WEATHER_NETWORK'
  | 'WEATHER_RATE_LIMITED'
  | 'WEATHER_REJECTED'
  | 'WEATHER_UNAVAILABLE'
  | 'WEATHER_BAD_RESPONSE'
  | 'TIME_INVALID'
  | 'STORAGE_UNAVAILABLE'
  | 'IMPORT_INVALID';

/** An error with a stable code and a message written for the rider, not the developer. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, message: string, opts: { detail?: string; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = opts.detail;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
