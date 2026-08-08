import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import { requireAuth } from '../../common/middleware/authenticate';
import { errorHandler } from '../../common/middleware/error-handler';
import { UserRole } from '../users/users.entity';
import { createTasksRouter } from './tasks.controller';
import { TaskPriority, TaskStatus } from './tasks.entity';
import { MyTaskFilter } from './tasks.repository';
import {
  CreateTaskDto,
  MyTaskProjection,
  TaskProjection,
  TaskService,
  UpdateTaskDto,
} from './tasks.service';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const TASK_ID = 'ce379e12-9464-4f42-9f04-19e04be1b4d1';
const MISSING_TASK_ID = '11111111-1111-4111-8111-111111111111';
const FORBIDDEN_TASK_ID = '33333333-3333-4333-8333-333333333333';
const GOAL_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const OTHER_GOAL_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_ID = '2894b41a-d903-421b-8cbb-4dbd48c836ab';

function taskProjection(overrides: Partial<TaskProjection> = {}): TaskProjection {
  return {
    id: TASK_ID,
    goalId: GOAL_ID,
    title: 'Build the task module',
    description: 'Implement task creation.',
    status: TaskStatus.TODO,
    priority: TaskPriority.HIGH,
    estimatedHours: 8,
    dueDate: '2026-09-05',
    assigneeId: null,
    assignee: null,
    businessImpact: null,
    priorityScore: null,
    overdue: false,
    dueDatePastGoalDeadline: false,
    createdAt: new Date('2026-08-08T08:00:00.000Z'),
    updatedAt: new Date('2026-08-08T08:00:00.000Z'),
    ...overrides,
  };
}

const taskService = {
  async createTask(goalId: string, dto: CreateTaskDto): Promise<TaskProjection> {
    if (goalId === OTHER_GOAL_ID) throw new ForbiddenError();
    return taskProjection({
      goalId,
      title: dto.title,
      description: dto.description ?? '',
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      dueDate: dto.dueDate,
      dueDatePastGoalDeadline: dto.dueDate > '2026-09-10',
    });
  },
  async listGoalTasks(): Promise<TaskProjection[]> {
    return [taskProjection()];
  },
  async getMyTasks(callerId: string, filter: MyTaskFilter): Promise<MyTaskProjection[]> {
    return [
      {
        id: TASK_ID,
        goalId: GOAL_ID,
        title: 'Build the task module',
        status: filter.status ?? TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        estimatedHours: 8,
        dueDate: filter.dueBefore ? '2026-08-31' : '2026-09-05',
        overdue: false,
        goal: { id: GOAL_ID, title: `Release TrackIt for ${callerId}` },
      },
    ];
  },
  async getTask(taskId: string): Promise<TaskProjection> {
    if (taskId === MISSING_TASK_ID) throw new NotFoundError('Task not found');
    return taskProjection({ id: taskId });
  },
  async updateTask(_taskId: string, dto: UpdateTaskDto): Promise<TaskProjection> {
    return taskProjection(dto);
  },
  async updateStatus(
    taskId: string,
    status: TaskStatus,
  ): Promise<TaskProjection> {
    if (taskId === MISSING_TASK_ID) throw new NotFoundError('Task not found');
    if (taskId === FORBIDDEN_TASK_ID) throw new ForbiddenError();
    return taskProjection({ status });
  },
  async assignTask(_taskId: string, assigneeId: string | null): Promise<TaskProjection> {
    return taskProjection({
      assigneeId,
      assignee: assigneeId ? { id: assigneeId, name: 'Asha Silva' } : null,
    });
  },
} as unknown as TaskService;

const app = express();
app.use(express.json());
app.use(createTasksRouter(taskService, requireAuth(JWT_SECRET)));
app.use(errorHandler);

let server: Server;
let baseUrl: string;

before(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    }),
);

after(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
);

function authorizationHeader(role: UserRole): { Authorization: string } {
  const token = jwt.sign({ userId: `${role.toLowerCase()}-id`, role }, JWT_SECRET, {
    expiresIn: '24h',
  });
  return { Authorization: `Bearer ${token}` };
}

function validTaskBody(estimatedHours = 8): string {
  return JSON.stringify({
    title: 'Build the task module',
    description: 'Implement task creation.',
    priority: TaskPriority.HIGH,
    estimatedHours,
    dueDate: '2026-09-05',
  });
}

for (const role of [UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD]) {
  test(`${role} can create a task`, async () => {
    const response = await fetch(`${baseUrl}/goals/${GOAL_ID}/tasks`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: validTaskBody(),
    });
    const body = (await response.json()) as { task: TaskProjection };

    assert.equal(response.status, 201);
    assert.equal(body.task.status, TaskStatus.TODO);
    assert.equal(body.task.assignee, null);
  });
}

test('an Employee cannot create a task', async () => {
  const response = await fetch(`${baseUrl}/goals/${GOAL_ID}/tasks`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: validTaskBody(),
  });

  assert.equal(response.status, 403);
});

test('a Team Lead receives 403 when creating under another team goal', async () => {
  const response = await fetch(`${baseUrl}/goals/${OTHER_GOAL_ID}/tasks`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: validTaskBody(),
  });

  assert.equal(response.status, 403);
});

for (const invalidHours of [0, -1]) {
  test(`POST /goals/:goalId/tasks rejects ${invalidHours} estimated hours`, async () => {
    const response = await fetch(`${baseUrl}/goals/${GOAL_ID}/tasks`, {
      method: 'POST',
      headers: {
        ...authorizationHeader(UserRole.TEAM_LEAD),
        'Content-Type': 'application/json',
      },
      body: validTaskBody(invalidHours),
    });

    assert.equal(response.status, 400);
  });
}

test('POST /goals/:goalId/tasks validates fields and date-only values', async () => {
  const response = await fetch(`${baseUrl}/goals/${GOAL_ID}/tasks`, {
    method: 'POST',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: ' ',
      priority: 'URGENT',
      estimatedHours: 'eight',
      dueDate: '2026-02-30',
    }),
  });

  assert.equal(response.status, 400);
});

for (const role of Object.values(UserRole)) {
  test(`${role} can list tasks visible under a goal`, async () => {
    const response = await fetch(`${baseUrl}/goals/${GOAL_ID}/tasks`, {
      headers: authorizationHeader(role),
    });
    const body = (await response.json()) as { tasks: TaskProjection[] };

    assert.equal(response.status, 200);
    assert.equal(body.tasks[0].goalId, GOAL_ID);
  });
}

test('GET /tasks/mine returns the caller-scoped list with validated filters', async () => {
  const response = await fetch(
    `${baseUrl}/tasks/mine?status=IN_PROGRESS&dueBefore=2026-09-01`,
    { headers: authorizationHeader(UserRole.EMPLOYEE) },
  );
  const body = (await response.json()) as { tasks: MyTaskProjection[] };

  assert.equal(response.status, 200);
  assert.equal(body.tasks[0].status, TaskStatus.IN_PROGRESS);
  assert.equal(body.tasks[0].dueDate, '2026-08-31');
  assert.match(body.tasks[0].goal.title, /employee-id/);
});

test('GET /tasks/mine rejects invalid filters and requires authentication', async () => {
  const invalidStatusResponse = await fetch(`${baseUrl}/tasks/mine?status=STARTED`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });
  const invalidDateResponse = await fetch(`${baseUrl}/tasks/mine?dueBefore=2026-02-30`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });
  const unauthenticatedResponse = await fetch(`${baseUrl}/tasks/mine`);

  assert.equal(invalidStatusResponse.status, 400);
  assert.equal(invalidDateResponse.status, 400);
  assert.equal(unauthenticatedResponse.status, 401);
});

test('GET /tasks/:id returns task details and service errors', async () => {
  const taskResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    headers: authorizationHeader(UserRole.EMPLOYEE),
  });
  const missingResponse = await fetch(`${baseUrl}/tasks/${MISSING_TASK_ID}`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });

  assert.equal(taskResponse.status, 200);
  assert.equal(missingResponse.status, 404);
});

test('PATCH /tasks/:id updates allowed fields for a Team Lead', async () => {
  const response = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Updated task', estimatedHours: 12 }),
  });
  const body = (await response.json()) as { task: TaskProjection };

  assert.equal(response.status, 200);
  assert.equal(body.task.title, 'Updated task');
  assert.equal(body.task.estimatedHours, 12);
});

test('PATCH /tasks/:id rejects empty bodies, invalid estimates, and Employees', async () => {
  const emptyResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const invalidEstimateResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ estimatedHours: -2 }),
  });
  const protectedFieldResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Allowed title', status: TaskStatus.DONE }),
  });
  const employeeResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Not allowed' }),
  });

  assert.equal(emptyResponse.status, 400);
  assert.equal(invalidEstimateResponse.status, 400);
  assert.equal(protectedFieldResponse.status, 400);
  assert.equal(employeeResponse.status, 403);
});

for (const role of Object.values(UserRole)) {
  test(`PATCH /tasks/:id/status allows an authorized ${role}`, async () => {
    const response = await fetch(`${baseUrl}/tasks/${TASK_ID}/status`, {
      method: 'PATCH',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: TaskStatus.DONE }),
    });
    const body = (await response.json()) as { task: TaskProjection };

    assert.equal(response.status, 200);
    assert.equal(body.task.status, TaskStatus.DONE);
  });
}

test('PATCH /tasks/:id/status validates the body and returns service authorization errors', async () => {
  const invalidStatusResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/status`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'STARTED' }),
  });
  const protectedFieldResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/status`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: TaskStatus.DONE, title: 'Not allowed' }),
  });
  const forbiddenResponse = await fetch(`${baseUrl}/tasks/${FORBIDDEN_TASK_ID}/status`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: TaskStatus.DONE }),
  });
  const missingResponse = await fetch(`${baseUrl}/tasks/${MISSING_TASK_ID}/status`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.SUPER_ADMIN),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: TaskStatus.DONE }),
  });

  assert.equal(invalidStatusResponse.status, 400);
  assert.equal(protectedFieldResponse.status, 400);
  assert.equal(forbiddenResponse.status, 403);
  assert.equal(missingResponse.status, 404);
});

test('PATCH /tasks/:id/status validates the task UUID and requires authentication', async () => {
  const invalidIdResponse = await fetch(`${baseUrl}/tasks/not-a-uuid/status`, {
    method: 'PATCH',
    headers: {
      ...authorizationHeader(UserRole.EMPLOYEE),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: TaskStatus.DONE }),
  });
  const unauthenticatedResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: TaskStatus.DONE }),
  });

  assert.equal(invalidIdResponse.status, 400);
  assert.equal(unauthenticatedResponse.status, 401);
});

test('PUT /tasks/:id/assignee assigns and unassigns for a Team Lead', async () => {
  const assignedResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/assignee`, {
    method: 'PUT',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assigneeId: EMPLOYEE_ID }),
  });
  const assignedBody = (await assignedResponse.json()) as { task: TaskProjection };
  const unassignedResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/assignee`, {
    method: 'PUT',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assigneeId: null }),
  });
  const unassignedBody = (await unassignedResponse.json()) as { task: TaskProjection };

  assert.equal(assignedResponse.status, 200);
  assert.deepEqual(assignedBody.task.assignee, { id: EMPLOYEE_ID, name: 'Asha Silva' });
  assert.equal(unassignedResponse.status, 200);
  assert.equal(unassignedBody.task.assignee, null);
});

test('PUT /tasks/:id/assignee rejects invalid bodies', async () => {
  for (const body of [
    {},
    { assigneeId: 'not-a-uuid' },
    { assigneeId: EMPLOYEE_ID, unexpected: true },
  ]) {
    const response = await fetch(`${baseUrl}/tasks/${TASK_ID}/assignee`, {
      method: 'PUT',
      headers: {
        ...authorizationHeader(UserRole.TEAM_LEAD),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    assert.equal(response.status, 400);
  }
});

for (const role of [UserRole.EMPLOYEE, UserRole.SUPER_ADMIN]) {
  test(`PUT /tasks/:id/assignee rejects ${role}`, async () => {
    const response = await fetch(`${baseUrl}/tasks/${TASK_ID}/assignee`, {
      method: 'PUT',
      headers: {
        ...authorizationHeader(role),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assigneeId: EMPLOYEE_ID }),
    });

    assert.equal(response.status, 403);
  });
}

test('PUT /tasks/:id/assignee validates the task UUID and requires authentication', async () => {
  const invalidIdResponse = await fetch(`${baseUrl}/tasks/not-a-uuid/assignee`, {
    method: 'PUT',
    headers: {
      ...authorizationHeader(UserRole.TEAM_LEAD),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assigneeId: EMPLOYEE_ID }),
  });
  const unauthenticatedResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}/assignee`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigneeId: EMPLOYEE_ID }),
  });

  assert.equal(invalidIdResponse.status, 400);
  assert.equal(unauthenticatedResponse.status, 401);
});

test('task routes validate UUIDs and require authentication', async () => {
  const invalidIdResponse = await fetch(`${baseUrl}/tasks/not-a-uuid`, {
    headers: authorizationHeader(UserRole.SUPER_ADMIN),
  });
  const unauthenticatedResponse = await fetch(`${baseUrl}/tasks/${TASK_ID}`);

  assert.equal(invalidIdResponse.status, 400);
  assert.equal(unauthenticatedResponse.status, 401);
});
