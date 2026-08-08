import { Router } from 'express';
import { AppDataSource } from '../data-source';

/**
 * Liveness + database connectivity check. This proves the full stack from route to
 * database, so it deliberately hits the database rather than reporting a static OK.
 *
 * Health is infrastructure, not a domain module, so it does not follow the
 * controller/service/repository/entity layering.
 */
export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await AppDataSource.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});
