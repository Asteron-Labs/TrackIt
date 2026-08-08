import express, { Express } from 'express';
import { healthRouter } from './health/health.controller';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler';
import { cors } from './common/middleware/cors';
import { requireAuth } from './common/middleware/authenticate';
import { ScopeService } from './common/authorization/scope.service';
import { env } from './common/config';
import { AppDataSource } from './data-source';
import { createAuthRouter } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { createTeamsRouter } from './modules/teams/teams.controller';
import { TeamRepository } from './modules/teams/teams.repository';
import { TeamsService } from './modules/teams/teams.service';
import { createGoalsRouter } from './modules/goals/goals.controller';
import { GoalRepository } from './modules/goals/goals.repository';
import { GoalService } from './modules/goals/goals.service';
import { createTasksRouter } from './modules/tasks/tasks.controller';
import { TaskRepository } from './modules/tasks/tasks.repository';
import { TaskService } from './modules/tasks/tasks.service';
import { createTimesheetsRouter } from './modules/timesheets/timesheets.controller';
import { TimesheetRepository } from './modules/timesheets/timesheets.repository';
import { TimesheetService } from './modules/timesheets/timesheets.service';
import { createUsersRouter } from './modules/users/users.controller';
import { UserRepository } from './modules/users/users.repository';
import { UsersService } from './modules/users/users.service';

/**
 * Builds the Express application: shared middleware, routes, then the terminal
 * not-found and centralised error handlers (which must come last, in that order).
 */
export function createApp(): Express {
  const app = express();

  app.use(cors(env.CORS_ORIGIN));
  app.use(express.json());

  app.use(healthRouter);

  const usersService = new UsersService(new UserRepository(AppDataSource));
  const teamsService = new TeamsService(new TeamRepository(AppDataSource), usersService);
  const scopeService = new ScopeService(teamsService);
  const taskRepository = new TaskRepository(AppDataSource);
  const goalService = new GoalService(
    new GoalRepository(AppDataSource),
    taskRepository,
    scopeService,
  );
  const taskService = new TaskService(taskRepository, goalService, teamsService, scopeService);
  const timesheetService = new TimesheetService(
    new TimesheetRepository(AppDataSource),
    taskService,
    scopeService,
  );
  const authService = new AuthService(usersService, env.JWT_SECRET);
  const authenticationMiddleware = requireAuth(env.JWT_SECRET);

  app.use('/auth', createAuthRouter(authService, authenticationMiddleware));
  app.use('/users', createUsersRouter(usersService, authenticationMiddleware));
  app.use('/teams', createTeamsRouter(teamsService, authenticationMiddleware));
  app.use(createGoalsRouter(goalService, authenticationMiddleware));
  app.use(createTasksRouter(taskService, authenticationMiddleware));
  app.use('/timesheets', createTimesheetsRouter(timesheetService, authenticationMiddleware));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
