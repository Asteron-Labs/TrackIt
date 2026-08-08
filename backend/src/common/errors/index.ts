/**
 * Domain error hierarchy. Services throw these; the centralised error handler
 * (see `common/middleware/error-handler.ts`) maps each to an HTTP status code.
 * Nothing in a service should ever set a status code directly.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 — request understood but semantically invalid. */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, message);
  }
}

/** 401 — no token, expired, or malformed. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

/** 403 — valid token, wrong role or resource outside caller's scope. */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

/** 404 — resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

/** 409 — request conflicts with current state (e.g. uniqueness). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}
