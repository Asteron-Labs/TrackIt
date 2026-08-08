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
  MyTaskFilter,
  TaskAccessFilter,
  TaskRepository,
  TaskWithGoalRecord,
  UpdateTaskRecord,
} from './tasks.repository';
import { isTaskOverdue, TaskService } from './tasks.service';

const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const GOAL_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';
const OTHER_EMPLOYEE_ID = '4e624b36-454c-4c6d-8a69-551c8238f7c2';
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
    progress: 0,
    noTasksYet: true,
    taskStatusBreakdown: {
      total: 0,
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
    },
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

test('getMyTasks forwards server-side filters and includes the joined parent goal', async () => {
  let receivedAssigneeId: string | undefined;
  let receivedFilter: MyTaskFilter | undefined;
  const record: TaskWithGoalRecord = {
    task: storedTask({ assigneeId: EMPLOYEE_ID, dueDate: '2026-08-07' }),
    goal: {
      id: GOAL_ID,
      title: 'Release TrackIt',
      deadline: '2026-09-10',
    },
  };
  const service = createService({
    findByAssignee: async (assigneeId, filter) => {
      receivedAssigneeId = assigneeId;
      receivedFilter = filter;
      return [record];
    },
  });

  const tasks = await service.getMyTasks(EMPLOYEE_ID, {
    status: TaskStatus.TODO,
    dueBefore: '2026-09-01',
  });

  assert.equal(receivedAssigneeId, EMPLOYEE_ID);
  assert.deepEqual(receivedFilter, {
    status: TaskStatus.TODO,
    dueBefore: '2026-09-01',
  });
  assert.deepEqual(tasks[0].goal, { id: GOAL_ID, title: 'Release TrackIt' });
  assert.equal(tasks[0].overdue, true);
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

test('updateStatus lets an Employee update their own assigned task', async () => {
  let ownershipCheck: { userId: string; ownerId: string } | undefined;
  let updatedStatus: TaskStatus | undefined;
  const service = createService(
    {
      findById: async () => storedTask({ assigneeId: EMPLOYEE_ID }),
      updateStatus: async (_taskId, status) => {
        updatedStatus = status;
        return storedTask({ assigneeId: null, status });
      },
    },
    undefined,
    undefined,
    {
      assertOwnsResource: (userId, ownerId) => {
        ownershipCheck = { userId, ownerId };
      },
    },
  );

  const task = await service.updateStatus(
    TASK_ID,
    TaskStatus.IN_PROGRESS,
    caller(UserRole.EMPLOYEE, EMPLOYEE_ID),
  );

  assert.deepEqual(ownershipCheck, { userId: EMPLOYEE_ID, ownerId: EMPLOYEE_ID });
  assert.equal(updatedStatus, TaskStatus.IN_PROGRESS);
  assert.equal(task.status, TaskStatus.IN_PROGRESS);
});

test("updateStatus rejects an Employee changing another employee's task", async () => {
  let updateWasCalled = false;
  const service = createService(
    {
      findById: async () => storedTask({ assigneeId: OTHER_EMPLOYEE_ID }),
      updateStatus: async () => {
        updateWasCalled = true;
        return storedTask();
      },
    },
    undefined,
    undefined,
    {
      assertOwnsResource: () => {
        throw new ForbiddenError('You can only update your own tasks');
      },
    },
  );

  await assert.rejects(
    () => service.updateStatus(TASK_ID, TaskStatus.DONE, caller(UserRole.EMPLOYEE, EMPLOYEE_ID)),
    (error: unknown) => error instanceof ForbiddenError,
  );
  assert.equal(updateWasCalled, false);
});

for (const role of [UserRole.TEAM_LEAD, UserRole.SUPER_ADMIN]) {
  test(`updateStatus lets ${role} update an authorized task`, async () => {
    let goalCaller: AuthenticatedUser | undefined;
    const service = createService(
      {
        findById: async () => storedTask({ assigneeId: OTHER_EMPLOYEE_ID }),
        updateStatus: async (_taskId, status) => storedTask({ assigneeId: null, status }),
      },
      {
        getGoal: async (_goalId, receivedCaller) => {
          goalCaller = receivedCaller;
          return goalProjection();
        },
      },
    );

    const task = await service.updateStatus(TASK_ID, TaskStatus.BLOCKED, caller(role));

    assert.equal(goalCaller?.role, role);
    assert.equal(task.status, TaskStatus.BLOCKED);
  });
}

test('updateStatus rejects a Team Lead outside the task team without persisting', async () => {
  let updateWasCalled = false;
  const service = createService(
    {
      findById: async () => storedTask(),
      updateStatus: async () => {
        updateWasCalled = true;
        return storedTask();
      },
    },
    {
      getGoal: async () => {
        throw new ForbiddenError('You do not have access to this goal');
      },
    },
  );

  await assert.rejects(
    () => service.updateStatus(TASK_ID, TaskStatus.DONE, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof ForbiddenError,
  );
  assert.equal(updateWasCalled, false);
});

test('updateStatus returns 404 when the task does not exist', async () => {
  const service = createService({ findById: async () => null });

  await assert.rejects(
    () => service.updateStatus(TASK_ID, TaskStatus.DONE, caller(UserRole.EMPLOYEE)),
    (error: unknown) => error instanceof NotFoundError,
  );
});

test('assignTask reassigns a task to a member of the owning team', async () => {
  let checkedLeadTeamId: string | undefined;
  let checkedMember: { userId: string; teamId: string } | undefined;
  let updatedAssigneeId: string | null | undefined;
  const service = createService(
    {
      findById: async () => storedTask({ assigneeId: EMPLOYEE_ID }),
      updateAssignee: async (_taskId, assigneeId) => {
        updatedAssigneeId = assigneeId;
        return storedTask({ assigneeId });
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
            id: OTHER_EMPLOYEE_ID,
            name: 'Nimal Perera',
            email: 'nimal@example.com',
            role: UserRole.EMPLOYEE,
            teamId: TEAM_ID,
            joinedAt: CREATED_AT,
          },
        ],
        memberCount: 1,
      }),
    },
    {
      assertTeamLeadOf: async (_userId, teamId) => {
        checkedLeadTeamId = teamId;
      },
      assertMemberOf: async (userId, teamId) => {
        checkedMember = { userId, teamId };
      },
    },
  );

  const task = await service.assignTask(TASK_ID, OTHER_EMPLOYEE_ID, caller(UserRole.TEAM_LEAD));

  assert.equal(checkedLeadTeamId, TEAM_ID);
  assert.deepEqual(checkedMember, { userId: OTHER_EMPLOYEE_ID, teamId: TEAM_ID });
  assert.equal(updatedAssigneeId, OTHER_EMPLOYEE_ID);
  assert.deepEqual(task.assignee, { id: OTHER_EMPLOYEE_ID, name: 'Nimal Perera' });
});

test('assignTask returns 404 when the task does not exist', async () => {
  const service = createService({ findById: async () => null });

  await assert.rejects(
    () => service.assignTask(TASK_ID, EMPLOYEE_ID, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof NotFoundError,
  );
});

test('assignTask rejects an assignee outside the owning team without persisting', async () => {
  let updateWasCalled = false;
  const service = createService(
    {
      findById: async () => storedTask(),
      updateAssignee: async () => {
        updateWasCalled = true;
        return storedTask();
      },
    },
    undefined,
    undefined,
    {
      assertTeamLeadOf: async () => undefined,
      assertMemberOf: async () => {
        throw new ForbiddenError('Assignee is not a member of this team');
      },
    },
  );

  await assert.rejects(
    () => service.assignTask(TASK_ID, OTHER_EMPLOYEE_ID, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof ForbiddenError,
  );
  assert.equal(updateWasCalled, false);
});

test('assignTask rejects a task owned by another team without persisting', async () => {
  let updateWasCalled = false;
  const service = createService(
    {
      findById: async () => storedTask(),
      updateAssignee: async () => {
        updateWasCalled = true;
        return storedTask();
      },
    },
    {
      getGoal: async () => {
        throw new ForbiddenError('You do not have access to this goal');
      },
    },
  );

  await assert.rejects(
    () => service.assignTask(TASK_ID, EMPLOYEE_ID, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof ForbiddenError,
  );
  assert.equal(updateWasCalled, false);
});

test('assignTask returns a task to unassigned without checking membership', async () => {
  let updatedAssigneeId: string | null | undefined;
  const service = createService(
    {
      findById: async () => storedTask({ assigneeId: EMPLOYEE_ID }),
      updateAssignee: async (_taskId, assigneeId) => {
        updatedAssigneeId = assigneeId;
        return storedTask({ assigneeId });
      },
    },
    undefined,
    undefined,
    {
      assertTeamLeadOf: async () => undefined,
      assertMemberOf: async () => {
        throw new Error('Unassignment should not check membership');
      },
    },
  );

  const task = await service.assignTask(TASK_ID, null, caller(UserRole.TEAM_LEAD));

  assert.equal(updatedAssigneeId, null);
  assert.equal(task.assigneeId, null);
  assert.equal(task.assignee, null);
});

for (const role of [UserRole.EMPLOYEE, UserRole.SUPER_ADMIN]) {
  test(`assignTask rejects ${role} callers`, async () => {
    let lookupWasCalled = false;
    const service = createService({
      findById: async () => {
        lookupWasCalled = true;
        return storedTask();
      },
    });

    await assert.rejects(
      () => service.assignTask(TASK_ID, EMPLOYEE_ID, caller(role)),
      (error: unknown) => error instanceof ForbiddenError,
    );
    assert.equal(lookupWasCalled, false);
  });
}

test('overdue follows the shared task definition', () => {
  assert.equal(isTaskOverdue('2026-08-07', TaskStatus.TODO, '2026-08-08'), true);
  assert.equal(isTaskOverdue('2026-08-08', TaskStatus.TODO, '2026-08-08'), false);
  assert.equal(isTaskOverdue('2026-08-07', TaskStatus.DONE, '2026-08-08'), false);
});
