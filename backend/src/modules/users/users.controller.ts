import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../../common/config/constants';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from './users.entity';
import { UsersService } from './users.service';

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase()),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: z.nativeEnum(UserRole),
});

const listUsersSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  unassigned: z.enum(['true', 'false']).optional(),
});

export function createUsersRouter(usersService: UsersService, requireAuth: RequestHandler): Router {
  const usersRouter = Router();

  usersRouter.use(requireAuth, requireRole(UserRole.SUPER_ADMIN));

  usersRouter.post('/', validate({ body: createUserSchema }), async (req, res, next) => {
    try {
      const user = await usersService.createUser(req.body);
      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  });

  usersRouter.get('/', validate({ query: listUsersSchema }), async (req, res, next) => {
    try {
      const users = await usersService.listUsers({
        role: req.query.role as UserRole | undefined,
        unassigned: req.query.unassigned === 'true',
      });
      res.status(200).json({ users });
    } catch (error) {
      next(error);
    }
  });

  return usersRouter;
}
