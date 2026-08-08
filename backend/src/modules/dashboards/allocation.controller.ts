import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import {
  AllocationService,
  CompanySummaryFilter,
  TeamSummaryRange,
} from './allocation.service';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Invalid date');

const teamSummaryParamsSchema = z.object({
  teamId: z.string().uuid(),
});

const teamSummaryRangeSchema = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
  })
  .strict();

const companySummaryQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    teamId: z.string().uuid().optional(),
    goalId: z.string().uuid().optional(),
  })
  .strict()
  .refine((query) => Boolean(query.from) === Boolean(query.to), {
    message: 'From and to dates must be provided together',
  });

export function createAllocationRouter(
  allocationService: AllocationService,
  requireAuth: RequestHandler,
): Router {
  const allocationRouter = Router();

  allocationRouter.use(requireAuth);
  allocationRouter.get(
    '/:teamId/summary',
    requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
    validate({ params: teamSummaryParamsSchema, query: teamSummaryRangeSchema }),
    async (req, res, next) => {
      try {
        const summary = await allocationService.getTeamSummary(
          req.params.teamId,
          req.query as unknown as TeamSummaryRange,
          req.user!,
        );
        res.status(200).json(summary);
      } catch (error) {
        next(error);
      }
    },
  );

  return allocationRouter;
}

export function createCompanyAllocationRouter(
  allocationService: AllocationService,
  requireAuth: RequestHandler,
): Router {
  const companyAllocationRouter = Router();

  companyAllocationRouter.use(requireAuth);
  companyAllocationRouter.get(
    '/summary',
    requireRole(UserRole.SUPER_ADMIN),
    validate({ query: companySummaryQuerySchema }),
    async (req, res, next) => {
      try {
        const summary = await allocationService.getCompanySummary(
          req.query as unknown as CompanySummaryFilter,
          req.user!,
        );
        res.status(200).json(summary);
      } catch (error) {
        next(error);
      }
    },
  );

  return companyAllocationRouter;
}
