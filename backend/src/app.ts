import express, { Express } from 'express';
import { healthRouter } from './health/health.controller';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler';
import { requireAuth } from './common/middleware/authenticate';
import { env } from './common/config';
import { AppDataSource } from './data-source';
import { createAuthRouter } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { UserRepository } from './modules/users/users.repository';
import { UsersService } from './modules/users/users.service';

/**
 * Builds the Express application: shared middleware, routes, then the terminal
 * not-found and centralised error handlers (which must come last, in that order).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use(healthRouter);

  const usersService = new UsersService(new UserRepository(AppDataSource));
  const authService = new AuthService(usersService, env.JWT_SECRET);
  app.use('/auth', createAuthRouter(authService, requireAuth(env.JWT_SECRET)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
