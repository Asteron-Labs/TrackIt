import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { Goal } from '../goals/goals.entity';
import { Task, TaskStatus } from './tasks.entity';
import { TaskRepository } from './tasks.repository';

interface RecordedClause {
  clause: string;
  parameters?: Record<string, unknown>;
}

function createRepository(rawRows: Array<Record<string, unknown>> = [], entities: Task[] = []) {
  const joins: Array<[unknown, string, string]> = [];
  const whereClauses: RecordedClause[] = [];
  const orderClauses: Array<[string, string]> = [];
  const selectedColumns: Array<[string, string]> = [];
  const groupClauses: string[] = [];
  const updates: Array<{ taskId: string; changes: Partial<Task> }> = [];
  const storedTask = { id: 'task-id', assigneeId: null } as Task;
  const queryBuilder = {
    innerJoin(table: unknown, alias: string, condition: string) {
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
    async getRawAndEntities() {
      return { entities, raw: rawRows };
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

test('findByAssignee joins the parent goal and applies all filters in SQL', async () => {
  const assignedTask = { id: 'task-id', goalId: 'goal-id' } as Task;
  const { repository, joins, whereClauses, orderClauses, selectedColumns } = createRepository(
    [
      {
        parent_goal_id: 'goal-id',
        parent_goal_title: 'Release TrackIt',
        parent_goal_deadline: '2026-09-10',
      },
    ],
    [assignedTask],
  );

  const records = await repository.findByAssignee('employee-id', {
    status: TaskStatus.IN_PROGRESS,
    dueBefore: '2026-09-01',
  });

  assert.deepEqual(joins, [[Goal, 'goal', 'goal.id = task.goal_id']]);
  assert.deepEqual(selectedColumns, [
    ['goal.id', 'parent_goal_id'],
    ['goal.title', 'parent_goal_title'],
    ['goal.deadline', 'parent_goal_deadline'],
  ]);
  assert.deepEqual(whereClauses, [
    {
      clause: 'task.assignee_id = :assigneeId',
      parameters: { assigneeId: 'employee-id' },
    },
    {
      clause: 'task.status = :status',
      parameters: { status: TaskStatus.IN_PROGRESS },
    },
    {
      clause: 'task.due_date < :dueBefore',
      parameters: { dueBefore: '2026-09-01' },
    },
  ]);
  assert.deepEqual(orderClauses, [
    ['task.due_date', 'ASC'],
    ['task.title', 'ASC'],
  ]);
  assert.deepEqual(records, [
    {
      task: assignedTask,
      goal: {
        id: 'goal-id',
        title: 'Release TrackIt',
        deadline: '2026-09-10',
      },
    },
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

test('updateStatus persists and returns the updated task', async () => {
  const { repository, updates } = createRepository();

  const updatedTask = await repository.updateStatus('task-id', TaskStatus.DONE);

  assert.deepEqual(updates, [{ taskId: 'task-id', changes: { status: TaskStatus.DONE } }]);
  assert.equal(updatedTask.status, TaskStatus.DONE);
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
