import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

/**
 * GET /health — proves the full stack from route to database, flowing
 * controller -> service -> repository -> database.
 *
 * Health is infrastructure, not a domain module, but it deliberately follows the same layering
 * so this story demonstrates the convention (including a service receiving its repository by
 * constructor injection). Dependencies are wired here by hand — no DI container.
 *
 * Returns 200 when the database is reachable, 503 when it is not.
 */
const healthService = new HealthService(new HealthRepository(AppDataSource));

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const status = await healthService.getStatus();
  res.status(status.database === 'up' ? 200 : 503).json(status);
});
