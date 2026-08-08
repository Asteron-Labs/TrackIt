import express, { Express } from 'express';
import { healthRouter } from './health/health.controller';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler';

/**
 * Builds the Express application: shared middleware, routes, then the terminal
 * not-found and centralised error handlers (which must come last, in that order).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
