import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import { AllocationService, TeamSummaryRange } from './allocation.service';

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
