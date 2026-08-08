import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

/**
 * Terminal handler for any route that did not match. Registered after all routes,
 * before the error handler.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
};

/**
 * Centralised error handler. The single place request errors become HTTP responses:
 *   - ZodError (validation at the controller boundary) -> 400
 *   - AppError (domain error)                          -> its own statusCode
 *   - anything else                                    -> 500
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.flatten() },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message },
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { message: 'Internal server error' },
  });
};
