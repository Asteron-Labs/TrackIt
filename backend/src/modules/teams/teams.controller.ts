import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../common/middleware/authorize';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '../users/users.entity';
import { TeamsService } from './teams.service';

const createTeamSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  weeklyCapacityHours: z.number().positive().optional(),
});

const teamIdSchema = z.object({
  id: z.string().uuid(),
});

const teamMemberParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

export function createTeamsRouter(teamsService: TeamsService, requireAuth: RequestHandler): Router {
  const teamsRouter = Router();

  teamsRouter.use(requireAuth);

  teamsRouter.post(
    '/',
    requireRole(UserRole.SUPER_ADMIN),
    validate({ body: createTeamSchema }),
    async (req, res, next) => {
      try {
        const team = await teamsService.createTeam(req.body);
        res.status(201).json({ team });
      } catch (error) {
        next(error);
      }
    },
  );

  teamsRouter.get('/', async (req, res, next) => {
    try {
      const teams = await teamsService.listTeams(req.user!);
      res.status(200).json({ teams });
    } catch (error) {
      next(error);
    }
  });

  teamsRouter.post(
    '/:id/members',
    requireRole(UserRole.SUPER_ADMIN),
    validate({ params: teamIdSchema, body: userIdSchema }),
    async (req, res, next) => {
      try {
        const member = await teamsService.addMember(req.params.id, req.body.userId);
        res.status(201).json({ member });
      } catch (error) {
        next(error);
      }
    },
  );

  teamsRouter.delete(
    '/:id/members/:userId',
    requireRole(UserRole.SUPER_ADMIN),
    validate({ params: teamMemberParamsSchema }),
    async (req, res, next) => {
      try {
        await teamsService.removeMember(req.params.id, req.params.userId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  teamsRouter.put(
    '/:id/lead',
    requireRole(UserRole.SUPER_ADMIN),
    validate({ params: teamIdSchema, body: userIdSchema }),
    async (req, res, next) => {
      try {
        const lead = await teamsService.assignTeamLead(req.params.id, req.body.userId);
        res.status(200).json({ lead });
      } catch (error) {
        next(error);
      }
    },
  );

  teamsRouter.get('/:id', validate({ params: teamIdSchema }), async (req, res, next) => {
    try {
      const team = await teamsService.getTeamDetails(req.params.id, req.user!);
      res.status(200).json({ team });
    } catch (error) {
      next(error);
    }
  });

  return teamsRouter;
}
