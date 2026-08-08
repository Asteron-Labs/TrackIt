import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { Task, TaskStatus } from './tasks.entity';
import { TaskRepository } from './tasks.repository';

interface RecordedClause {
  clause: string;
  parameters?: Record<string, unknown>;
}

function createRepository(rawRows: Array<{ status: TaskStatus; count: string }> = []) {
  const joins: Array<[string, string, string]> = [];
  const whereClauses: RecordedClause[] = [];
  const orderClauses: Array<[string, string]> = [];
  const selectedColumns: Array<[string, string]> = [];
  const groupClauses: string[] = [];
  const updates: Array<{ taskId: string; changes: Partial<Task> }> = [];
  const storedTask = { id: 'task-id', assigneeId: null } as Task;
  const queryBuilder = {
    innerJoin(table: string, alias: string, condition: string) {
      joins.push([table, alias, condition]);
      return this;
    },
    select(column: string, alias: string) {
      selectedColumns.push([column, alias]);
      return this;
    },
    addSelect(column: string, alias: string) {
      selectedColumns.push([column, alias]);
      return this;
    },
    where(clause: string, parameters?: Record<string, unknown>) {
      whereClauses.push({ clause, parameters });
      return this;
    },
    andWhere(clause: string, parameters?: Record<string, unknown>) {
      whereClauses.push({ clause, parameters });
      return this;
    },
    orderBy(column: string, direction: string) {
      orderClauses.push([column, direction]);
      return this;
    },
    addOrderBy(column: string, direction: string) {
      orderClauses.push([column, direction]);
      return this;
    },
    groupBy(column: string) {
      groupClauses.push(column);
      return this;
    },
    async getOne() {
      return null;
    },
    async getMany() {
      return [];
    },
    async getRawMany() {
      return rawRows;
    },
  };
  const dataSource = {
    getRepository: () => ({
      createQueryBuilder: () => queryBuilder,
      async update(taskId: string, changes: Partial<Task>) {
        updates.push({ taskId, changes });
        Object.assign(storedTask, changes);
      },
      async findOneByOrFail() {
        return storedTask;
      },
    }),
  } as unknown as DataSource;

  return {
    repository: new TaskRepository(dataSource),
    joins,
    whereClauses,
    orderClauses,
    selectedColumns,
    groupClauses,
    updates,
  };
}

test('findByGoal applies team and assignee access in the query', async () => {
  const { repository, joins, whereClauses, orderClauses } = createRepository();

  await repository.findByGoal('goal-id', {
    teamId: 'team-id',
    assigneeId: 'employee-id',
  });

  assert.deepEqual(joins, [['goals', 'access_goal', 'access_goal.id = task.goal_id']]);
  assert.deepEqual(whereClauses, [
    { clause: 'task.goal_id = :goalId', parameters: { goalId: 'goal-id' } },
    {
      clause: 'access_goal.team_id = :accessTeamId',
      parameters: { accessTeamId: 'team-id' },
    },
    {
      clause: 'task.assignee_id = :accessAssigneeId',
      parameters: { accessAssigneeId: 'employee-id' },
    },
  ]);
  assert.deepEqual(orderClauses, [
    ['task.due_date', 'ASC'],
    ['task.title', 'ASC'],
  ]);
});

test('findById remains unrestricted when no access filter is supplied', async () => {
  const { repository, joins, whereClauses } = createRepository();

  await repository.findById('task-id');

  assert.deepEqual(joins, []);
  assert.deepEqual(whereClauses, [
    { clause: 'task.id = :taskId', parameters: { taskId: 'task-id' } },
  ]);
});

test('findByAssignee filters in SQL and orders by due date', async () => {
  const { repository, whereClauses, orderClauses } = createRepository();

  await repository.findByAssignee('employee-id');

  assert.deepEqual(whereClauses, [
    {
      clause: 'task.assignee_id = :assigneeId',
      parameters: { assigneeId: 'employee-id' },
    },
  ]);
  assert.deepEqual(orderClauses, [
    ['task.due_date', 'ASC'],
    ['task.title', 'ASC'],
  ]);
});

test('findByTeam joins through goals and filters in SQL', async () => {
  const { repository, joins, whereClauses } = createRepository();

  await repository.findByTeam('team-id');

  assert.deepEqual(joins, [['goals', 'goal', 'goal.id = task.goal_id']]);
  assert.deepEqual(whereClauses, [
    { clause: 'goal.team_id = :teamId', parameters: { teamId: 'team-id' } },
  ]);
});

test('updateAssignee assigns, reassigns, and clears the assignee', async () => {
  const { repository, updates } = createRepository();

  const assignedTask = await repository.updateAssignee('task-id', 'first-member-id');
  const reassignedTask = await repository.updateAssignee('task-id', 'second-member-id');
  const unassignedTask = await repository.updateAssignee('task-id', null);

  assert.deepEqual(updates, [
    { taskId: 'task-id', changes: { assigneeId: 'first-member-id' } },
    { taskId: 'task-id', changes: { assigneeId: 'second-member-id' } },
    { taskId: 'task-id', changes: { assigneeId: null } },
  ]);
  assert.equal(assignedTask.id, 'task-id');
  assert.equal(reassignedTask.id, 'task-id');
  assert.equal(unassignedTask.assigneeId, null);
});

test('countByGoalAndStatus returns all statuses from one grouped query', async () => {
  const { repository, whereClauses, selectedColumns, groupClauses } = createRepository([
    { status: TaskStatus.TODO, count: '3' },
    { status: TaskStatus.DONE, count: '1' },
  ]);

  const counts = await repository.countByGoalAndStatus('goal-id');

  assert.deepEqual(selectedColumns, [
    ['task.status', 'status'],
    ['COUNT(task.id)', 'count'],
  ]);
  assert.deepEqual(whereClauses, [
    { clause: 'task.goal_id = :goalId', parameters: { goalId: 'goal-id' } },
  ]);
  assert.deepEqual(groupClauses, ['task.status']);
  assert.deepEqual(counts, {
    TODO: 3,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    DONE: 1,
  });
});
