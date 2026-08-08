import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import { TaskPriority, TaskStatus } from './tasks.entity';
import { MyTaskFilter } from './tasks.repository';
import { TaskService } from './tasks.service';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Invalid date');

const createTaskSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    priority: z.nativeEnum(TaskPriority),
    estimatedHours: z.number().positive(),
    dueDate: dateOnlySchema,
  })
  .strict();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim(),
    priority: z.nativeEnum(TaskPriority),
    estimatedHours: z.number().positive(),
    dueDate: dateOnlySchema,
  })
  .strict()
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

const assignTaskSchema = z
  .object({
    assigneeId: z.string().uuid().nullable(),
  })
  .strict();

const myTaskFilterSchema = z
  .object({
    status: z.nativeEnum(TaskStatus).optional(),
    dueBefore: dateOnlySchema.optional(),
  })
  .strict();

const updateTaskStatusSchema = z
  .object({
    status: z.nativeEnum(TaskStatus),
  })
  .strict();

const goalIdSchema = z.object({
  goalId: z.string().uuid(),
});

const taskIdSchema = z.object({
  id: z.string().uuid(),
});

export function createTasksRouter(taskService: TaskService, requireAuth: RequestHandler): Router {
  const tasksRouter = Router();

  tasksRouter.use(requireAuth);

  tasksRouter.post(
    '/goals/:goalId/tasks',
    requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
    validate({ params: goalIdSchema, body: createTaskSchema }),
    async (req, res, next) => {
      try {
        const task = await taskService.createTask(req.params.goalId, req.body, req.user!);
        res.status(201).json({ task });
      } catch (error) {
        next(error);
      }
    },
  );

  tasksRouter.get(
    '/goals/:goalId/tasks',
    validate({ params: goalIdSchema }),
    async (req, res, next) => {
      try {
        const tasks = await taskService.listGoalTasks(req.params.goalId, req.user!);
        res.status(200).json({ tasks });
      } catch (error) {
        next(error);
      }
    },
  );

  tasksRouter.get(
    '/tasks/mine',
    validate({ query: myTaskFilterSchema }),
    async (req, res, next) => {
      try {
        const tasks = await taskService.getMyTasks(
          req.user!.userId,
          req.query as MyTaskFilter,
        );
        res.status(200).json({ tasks });
      } catch (error) {
        next(error);
      }
    },
  );

  tasksRouter.get('/tasks/:id', validate({ params: taskIdSchema }), async (req, res, next) => {
    try {
      const task = await taskService.getTask(req.params.id, req.user!);
      res.status(200).json({ task });
    } catch (error) {
      next(error);
    }
  });

  tasksRouter.patch(
    '/tasks/:id',
    requireRole(UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD),
    validate({ params: taskIdSchema, body: updateTaskSchema }),
    async (req, res, next) => {
      try {
        const task = await taskService.updateTask(req.params.id, req.body, req.user!);
        res.status(200).json({ task });
      } catch (error) {
        next(error);
      }
    },
  );

  tasksRouter.patch(
    '/tasks/:id/status',
    validate({ params: taskIdSchema, body: updateTaskStatusSchema }),
    async (req, res, next) => {
      try {
        const task = await taskService.updateStatus(req.params.id, req.body.status, req.user!);
        res.status(200).json({ task });
      } catch (error) {
        next(error);
      }
    },
  );

  tasksRouter.put(
    '/tasks/:id/assignee',
    requireRole(UserRole.TEAM_LEAD),
    validate({ params: taskIdSchema, body: assignTaskSchema }),
    async (req, res, next) => {
      try {
        const task = await taskService.assignTask(
          req.params.id,
          req.body.assigneeId,
          req.user!,
        );
        res.status(200).json({ task });
      } catch (error) {
        next(error);
      }
    },
  );

  return tasksRouter;
}
