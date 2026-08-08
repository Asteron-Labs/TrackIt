import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import { GoalImportance, GoalStatus } from './goals.entity';
import { GoalService } from './goals.service';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Invalid date');

const createGoalSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startDate: dateOnlySchema,
  deadline: dateOnlySchema,
  importance: z.nativeEnum(GoalImportance),
});

const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim(),
    startDate: dateOnlySchema,
    deadline: dateOnlySchema,
    status: z.nativeEnum(GoalStatus),
    importance: z.nativeEnum(GoalImportance),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

const goalIdSchema = z.object({
  id: z.string().uuid(),
});

const teamIdSchema = z.object({
  teamId: z.string().uuid(),
});

const goalFilterSchema = z.object({
  status: z.nativeEnum(GoalStatus).optional(),
});

export function createGoalsRouter(goalService: GoalService, requireAuth: RequestHandler): Router {
  const goalsRouter = Router();

  goalsRouter.use(requireAuth);

  goalsRouter.post(
    '/goals',
    requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
    validate({ body: createGoalSchema }),
    async (req, res, next) => {
      try {
        const goal = await goalService.createGoal(req.body, req.user!);
        res.status(201).json({ goal });
      } catch (error) {
        next(error);
      }
    },
  );

  goalsRouter.get(
    '/teams/:teamId/goals',
    validate({ params: teamIdSchema, query: goalFilterSchema }),
    async (req, res, next) => {
      try {
        const goals = await goalService.listTeamGoals(req.params.teamId, req.query, req.user!);
        res.status(200).json({ goals });
      } catch (error) {
        next(error);
      }
    },
  );

  goalsRouter.get('/goals/:id', validate({ params: goalIdSchema }), async (req, res, next) => {
    try {
      const goal = await goalService.getGoal(req.params.id, req.user!);
      res.status(200).json({ goal });
    } catch (error) {
      next(error);
    }
  });

  goalsRouter.patch(
    '/goals/:id',
    requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
    validate({ params: goalIdSchema, body: updateGoalSchema }),
    async (req, res, next) => {
      try {
        const goal = await goalService.updateGoal(req.params.id, req.body, req.user!);
        res.status(200).json({ goal });
      } catch (error) {
        next(error);
      }
    },
  );

  return goalsRouter;
}
