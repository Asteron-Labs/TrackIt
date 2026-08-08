import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import { TimesheetService } from './timesheets.service';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Invalid date');

const logTimeSchema = z
  .object({
    taskId: z.string().uuid(),
    workDate: dateOnlySchema,
    hoursSpent: z.number(),
    workNote: z.string().trim().optional(),
  })
  .strict();

const updateTimeEntrySchema = z
  .object({
    hoursSpent: z.number().optional(),
    workNote: z.string().trim().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

const entryIdSchema = z.object({
  id: z.string().uuid(),
});

export function createTimesheetsRouter(
  timesheetService: TimesheetService,
  requireAuth: RequestHandler,
): Router {
  const timesheetsRouter = Router();

  timesheetsRouter.use(requireAuth);
  timesheetsRouter.post(
    '/',
    requireRole(UserRole.EMPLOYEE),
    validate({ body: logTimeSchema }),
    async (req, res, next) => {
      try {
        const result = await timesheetService.logTime(req.body, req.user!);
        res.status(result.created ? 201 : 200).json({
          timesheetEntry: result.timesheetEntry,
          dailyTotalHours: result.dailyTotalHours,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  timesheetsRouter.patch(
    '/:id',
    requireRole(UserRole.EMPLOYEE),
    validate({ params: entryIdSchema, body: updateTimeEntrySchema }),
    async (req, res, next) => {
      try {
        const result = await timesheetService.updateEntry(req.params.id, req.body, req.user!);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  timesheetsRouter.delete(
    '/:id',
    requireRole(UserRole.EMPLOYEE),
    validate({ params: entryIdSchema }),
    async (req, res, next) => {
      try {
        await timesheetService.deleteEntry(req.params.id, req.user!);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return timesheetsRouter;
}
