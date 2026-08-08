import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export function createAuthRouter(authService: AuthService, requireAuth: RequestHandler): Router {
  const authRouter = Router();

  authRouter.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  authRouter.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await authService.getCurrentUser(req.user!.userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  return authRouter;
}
