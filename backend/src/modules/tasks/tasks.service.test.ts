import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { GoalImportance, GoalStatus } from '../goals/goals.entity';
import { TeamsService } from '../teams/teams.service';
import { UserRole } from '../users/users.entity';
import { Task, TaskPriority, TaskStatus } from './tasks.entity';
import {
  CreateTaskRecord,
  TaskAccessFilter,
  TaskRepository,
  UpdateTaskRecord,
} from './tasks.repository';
import { isTaskOverdue, TaskService } from './tasks.service';

const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const GOAL_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const CREATED_AT = new Date('2026-08-08T08:00:00.000Z');

function storedTask(overrides: Partial<Task> = {}): Task {
  const task = new Task();
  task.id = TASK_ID;
  task.goalId = GOAL_ID;
  task.title = 'Build the task module';
  task.description = 'Implement task creation.';
  task.status = TaskStatus.TODO;
  task.priority = TaskPriority.HIGH;
  task.estimatedHours = 8;
  task.dueDate = '2026-09-05';
  task.assigneeId = null;
  task.businessImpact = null;
  task.priorityScore = null;
  task.createdAt = CREATED_AT;
  task.updatedAt = CREATED_AT;
  return Object.assign(task, overrides);
}

function goalProjection(overrides: Partial<GoalProjection> = {}): GoalProjection {
  return {
    id: GOAL_ID,
    teamId: TEAM_ID,
    title: 'Release TrackIt',
    description: '',
    startDate: '2026-08-10',
    deadline: '2026-09-10',
    status: GoalStatus.ACTIVE,
    importance: GoalImportance.HIGH,
    createdById: 'creator-id',
    progress: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function caller(role: UserRole, userId = `${role.toLowerCase()}-id`): AuthenticatedUser {
  return { userId, role };
}

function createService(
  taskRepository: Partial<TaskRepository>,
  goalService: Partial<GoalService> = { getGoal: async () => goalProjection() },
  teamsService: Partial<TeamsService> = {},
  scopeService: Partial<ScopeService> = {},
): TaskService {
  return new TaskService(
    taskRepository as TaskRepository,
    goalService as GoalService,
    teamsService as TeamsService,
    scopeService as ScopeService,
  );
}

test('createTask checks Team Lead scope and creates an unassigned TODO task', async () => {
  let checkedTeamId: string | undefined;
  let createdRecord: CreateTaskRecord | undefined;
  const service = createService(
    {
      create: async (record) => {
        createdRecord = record;
        return storedTask(record);
      },
    },
    undefined,
    undefined,
    {
      assertTeamLeadOf: async (_userId, teamId) => {
        checkedTeamId = teamId;
      },
    },
  );

  const task = await service.createTask(
    GOAL_ID,
    {
      title: 'Build the task module',
      priority: TaskPriority.HIGH,
      estimatedHours: 8,
      dueDate: '2026-09-05',
    },
    caller(UserRole.TEAM_LEAD),
  );

  assert.equal(checkedTeamId, TEAM_ID);
  assert.deepEqual(createdRecord, {
    goalId: GOAL_ID,
    title: 'Build the task module',
    description: '',
    status: TaskStatus.TODO,
    priority: TaskPriority.HIGH,
    estimatedHours: 8,
    dueDate: '2026-09-05',
    assigneeId: null,
    businessImpact: null,
    priorityScore: null,
  });
  assert.equal(task.assignee, null);
  assert.equal(task.businessImpact, null);
  assert.equal(task.priorityScore, null);
  assert.equal(task.dueDatePastGoalDeadline, false);
});

test('createTask allows a Super Admin without a Team Lead scope assertion', async () => {
  const service = createService(
    { create: async (record) => storedTask(record) },
    undefined,
    undefined,
    {
      assertTeamLeadOf: async () => {
        throw new Error('Super Admin scope should not be checked');
      },
    },
  );

  await service.createTask(
    GOAL_ID,
    {
      title: 'Build the task module',
      priority: TaskPriority.HIGH,
      estimatedHours: 8,
      dueDate: '2026-09-05',
    },
    caller(UserRole.SUPER_ADMIN),
  );
});

test('createTask propagates cross-team authorization and does not persist', async () => {
  let createWasCalled = false;
  const service = createService(
    {
      create: async () => {
        createWasCalled = true;
        return storedTask();
      },
    },
    {
      getGoal: async () => {
        throw new ForbiddenError();
      },
    },
  );

  await assert.rejects(
    () =>
      service.createTask(
        GOAL_ID,
        {
          title: 'Hidden task',
          priority: TaskPriority.MEDIUM,
          estimatedHours: 4,
          dueDate: '2026-09-05',
        },
        caller(UserRole.TEAM_LEAD),
      ),
    (error: unknown) => error instanceof ForbiddenError,
  );
  assert.equal(createWasCalled, false);
});

test('createTask rejects a non-positive estimate in the service', async () => {
  const service = createService({}, undefined, undefined, {
    assertTeamLeadOf: async () => undefined,
  });

  await assert.rejects(
    () =>
      service.createTask(
        GOAL_ID,
        {
          title: 'Invalid task',
          priority: TaskPriority.LOW,
          estimatedHours: 0,
          dueDate: '2026-09-05',
        },
        caller(UserRole.TEAM_LEAD),
      ),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.message === 'Estimated hours must be greater than zero',
  );
});

test('createTask permits a due date past the goal deadline and returns a warning flag', async () => {
  const service = createService(
    { create: async (record) => storedTask(record) },
    undefined,
    undefined,
    { assertTeamLeadOf: async () => undefined },
  );

  const task = await service.createTask(
    GOAL_ID,
    {
      title: 'Late task',
      priority: TaskPriority.MEDIUM,
      estimatedHours: 4,
      dueDate: '2026-09-11',
    },
    caller(UserRole.TEAM_LEAD),
  );

  assert.equal(task.dueDatePastGoalDeadline, true);
});

test('listGoalTasks scopes Employee queries to their own assignments', async () => {
  let receivedAccess: TaskAccessFilter | undefined;
  const service = createService(
    {
      findByGoal: async (_goalId, access) => {
        receivedAccess = access;
        return [storedTask({ assigneeId: EMPLOYEE_ID })];
      },
    },
    undefined,
    {
      getTeamDetails: async () => ({
        id: TEAM_ID,
        name: 'Platform',
        description: '',
        leadId: null,
        weeklyCapacityHours: 40,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        lead: null,
        members: [
          {
            id: EMPLOYEE_ID,
            name: 'Asha Silva',
            email: 'asha@example.com',
            role: UserRole.EMPLOYEE,
            teamId: TEAM_ID,
            joinedAt: CREATED_AT,
          },
        ],
        memberCount: 1,
      }),
    },
  );

  const tasks = await service.listGoalTasks(GOAL_ID, caller(UserRole.EMPLOYEE, EMPLOYEE_ID));

  assert.deepEqual(receivedAccess, { teamId: TEAM_ID, assigneeId: EMPLOYEE_ID });
  assert.deepEqual(tasks[0].assignee, { id: EMPLOYEE_ID, name: 'Asha Silva' });
});

test('getTask returns 404 when the task does not exist', async () => {
  const service = createService({ findById: async () => null });

  await assert.rejects(
    () => service.getTask(TASK_ID, caller(UserRole.SUPER_ADMIN)),
    (error: unknown) => error instanceof NotFoundError,
  );
});

test('getTask returns 403 when the scoped task query excludes the caller', async () => {
  let lookupCount = 0;
  const service = createService({
    findById: async () => {
      lookupCount += 1;
      return lookupCount === 1 ? storedTask() : null;
    },
  });

  await assert.rejects(
    () => service.getTask(TASK_ID, caller(UserRole.EMPLOYEE, EMPLOYEE_ID)),
    (error: unknown) => error instanceof ForbiddenError,
  );
});

test('updateTask persists only editable fields for an authorized Team Lead', async () => {
  let receivedChanges: UpdateTaskRecord | undefined;
  const service = createService(
    {
      findById: async () => storedTask(),
      update: async (_taskId, changes) => {
        receivedChanges = changes;
        return storedTask(changes);
      },
    },
    undefined,
    undefined,
    { assertTeamLeadOf: async () => undefined },
  );

  const task = await service.updateTask(
    TASK_ID,
    { title: 'Updated task', estimatedHours: 12, dueDate: '2026-09-11' },
    caller(UserRole.TEAM_LEAD),
  );

  assert.deepEqual(receivedChanges, {
    title: 'Updated task',
    estimatedHours: 12,
    dueDate: '2026-09-11',
  });
  assert.equal(task.title, 'Updated task');
  assert.equal(task.dueDatePastGoalDeadline, true);
});

test('overdue follows the shared task definition', () => {
  assert.equal(isTaskOverdue('2026-08-07', TaskStatus.TODO, '2026-08-08'), true);
  assert.equal(isTaskOverdue('2026-08-08', TaskStatus.TODO, '2026-08-08'), false);
  assert.equal(isTaskOverdue('2026-08-07', TaskStatus.DONE, '2026-08-08'), false);
});
