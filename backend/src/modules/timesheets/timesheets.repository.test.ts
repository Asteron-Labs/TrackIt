import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { Goal } from '../goals/goals.entity';
import { Task } from '../tasks/tasks.entity';
import { User } from '../users/users.entity';
import { TimesheetEntry } from './timesheets.entity';
import { TimesheetRepository } from './timesheets.repository';

interface RecordedClause {
  clause: string;
  parameters?: Record<string, unknown>;
}

function createRepository(
  total = '0',
  rawRows: Record<string, string>[] = [],
  entities: TimesheetEntry[] = [],
) {
  const findCalls: unknown[] = [];
  const findOneCalls: unknown[] = [];
  const updateCalls: unknown[] = [];
  const findOneByOrFailCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];
  const whereClauses: RecordedClause[] = [];
  const joins: Array<[unknown, string, string]> = [];
  const selectedColumns: Array<[string, string | undefined]> = [];
  const orderClauses: Array<[string, string]> = [];
  const groupClauses: string[] = [];
  const queryBuilder = {
    innerJoin(table: unknown, alias: string, condition: string) {
      joins.push([table, alias, condition]);
      return this;
    },
    select(column: string, alias?: string) {
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
    addGroupBy(column: string) {
      groupClauses.push(column);
      return this;
    },
    async getRawOne() {
      return { total };
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
      find(options: unknown) {
        findCalls.push(options);
        return Promise.resolve([]);
      },
      findOne(options: unknown) {
        findOneCalls.push(options);
        return Promise.resolve(null);
      },
      update(id: string, changes: unknown) {
        updateCalls.push({ id, changes });
        return Promise.resolve({ affected: 1 });
      },
      findOneByOrFail(options: unknown) {
        findOneByOrFailCalls.push(options);
        return Promise.resolve({ id: 'entry-id', hoursSpent: 3, workNote: 'Updated' });
      },
      delete(id: string) {
        deleteCalls.push(id);
        return Promise.resolve({ affected: 1 });
      },
      createQueryBuilder: () => queryBuilder,
    }),
  } as unknown as DataSource;

  return {
    repository: new TimesheetRepository(dataSource),
    findCalls,
    findOneCalls,
    updateCalls,
    findOneByOrFailCalls,
    deleteCalls,
    whereClauses,
    joins,
    selectedColumns,
    orderClauses,
    groupClauses,
  };
}

test('find methods scope entries by employee and date', async () => {
  const { repository, findCalls, findOneCalls } = createRepository();

  await repository.findByEmployeeAndDate('employee-id', '2026-08-07');
  await repository.findByEmployeeAndTaskAndDate('employee-id', 'task-id', '2026-08-07');
  await repository.findById('entry-id');

  assert.deepEqual(findCalls, [
    {
      where: { employeeId: 'employee-id', workDate: '2026-08-07' },
      order: { createdAt: 'ASC' },
    },
  ]);
  assert.deepEqual(findOneCalls, [
    {
      where: {
        employeeId: 'employee-id',
        taskId: 'task-id',
        workDate: '2026-08-07',
      },
    },
    { where: { id: 'entry-id' } },
  ]);
});

test('update persists editable fields and returns the saved entry', async () => {
  const { repository, updateCalls, findOneByOrFailCalls } = createRepository();

  const entry = await repository.update('entry-id', {
    hoursSpent: 3,
    workNote: 'Updated',
  });

  assert.equal(entry.id, 'entry-id');
  assert.deepEqual(updateCalls, [
    {
      id: 'entry-id',
      changes: { hoursSpent: 3, workNote: 'Updated' },
    },
  ]);
  assert.deepEqual(findOneByOrFailCalls, [{ id: 'entry-id' }]);
});

test('delete removes the requested entry', async () => {
  const { repository, deleteCalls } = createRepository();

  await repository.delete('entry-id');

  assert.deepEqual(deleteCalls, ['entry-id']);
});

test('findByTask scopes in SQL and includes contributor identity', async () => {
  const entry = { id: 'entry-id', taskId: 'task-id' } as TimesheetEntry;
  const setup = createRepository(
    '0',
    [{ contributor_id: 'employee-id', contributor_name: 'Alex Employee' }],
    [entry],
  );

  const entries = await setup.repository.findByTask('task-id');

  assert.deepEqual(entries, [
    {
      entry,
      employee: { id: 'employee-id', name: 'Alex Employee' },
    },
  ]);
  assert.deepEqual(setup.joins, [
    [User, 'employee', 'employee.id = entry.employee_id'],
  ]);
  assert.deepEqual(setup.whereClauses, [
    { clause: 'entry.task_id = :taskId', parameters: { taskId: 'task-id' } },
  ]);
});

test('sumHoursByTaskIds groups one query and keeps zeroes for tasks without entries', async () => {
  const setup = createRepository('0', [
    { taskId: 'task-one', totalHours: '7.50' },
  ]);

  const totals = await setup.repository.sumHoursByTaskIds(['task-one', 'task-two']);

  assert.deepEqual([...totals], [
    ['task-one', 7.5],
    ['task-two', 0],
  ]);
  assert.deepEqual(setup.whereClauses, [
    {
      clause: 'entry.task_id IN (:...taskIds)',
      parameters: { taskIds: ['task-one', 'task-two'] },
    },
  ]);
  assert.deepEqual(setup.groupClauses, ['entry.task_id']);
});

test('sumHoursByTaskIds skips the query for an empty task set', async () => {
  const setup = createRepository();

  const totals = await setup.repository.sumHoursByTaskIds([]);

  assert.deepEqual([...totals], []);
  assert.deepEqual(setup.whereClauses, []);
});

test('sumHoursByEmployeeInRange uses inclusive date boundaries', async () => {
  const { repository, whereClauses } = createRepository('12');

  const total = await repository.sumHoursByEmployeeInRange(
    'employee-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.equal(total, 12);
  assert.deepEqual(whereClauses, [
    {
      clause: 'entry.employee_id = :employeeId',
      parameters: { employeeId: 'employee-id' },
    },
    {
      clause: 'entry.work_date BETWEEN :from AND :to',
      parameters: { from: '2026-08-01', to: '2026-08-07' },
    },
  ]);
});

test('findByEmployeeInRange scopes in SQL, joins task and goal, and includes the to date', async () => {
  const boundaryEntry = { id: 'entry-id', workDate: '2026-08-07' } as TimesheetEntry;
  const setup = createRepository(
    '0',
    [
      {
        history_task_id: 'task-id',
        history_task_title: 'Implement history',
        history_goal_id: 'goal-id',
        history_goal_title: 'Track effort',
      },
    ],
    [boundaryEntry],
  );

  const entries = await setup.repository.findByEmployeeInRange(
    'employee-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.equal(entries[0].entry.workDate, '2026-08-07');
  assert.deepEqual(entries[0].task, { id: 'task-id', title: 'Implement history' });
  assert.deepEqual(entries[0].goal, { id: 'goal-id', title: 'Track effort' });
  assert.deepEqual(setup.joins, [
    [Task, 'task', 'task.id = entry.task_id'],
    [Goal, 'goal', 'goal.id = task.goal_id'],
  ]);
  assert.deepEqual(setup.whereClauses, [
    {
      clause: 'entry.employee_id = :employeeId',
      parameters: { employeeId: 'employee-id' },
    },
    {
      clause: 'entry.work_date BETWEEN :from AND :to',
      parameters: { from: '2026-08-01', to: '2026-08-07' },
    },
  ]);
  assert.deepEqual(setup.orderClauses, [
    ['entry.work_date', 'DESC'],
    ['entry.created_at', 'DESC'],
  ]);
});

test('findByTeamInRange scopes through the task goal and returns member details', async () => {
  const boundaryEntry = { id: 'entry-id', workDate: '2026-08-07' } as TimesheetEntry;
  const setup = createRepository(
    '0',
    [
      {
        team_employee_id: 'employee-id',
        team_employee_name: 'Alex Employee',
        team_task_id: 'task-id',
        team_task_title: 'Implement effort view',
        team_goal_id: 'goal-id',
        team_goal_title: 'Track delivery',
      },
    ],
    [boundaryEntry],
  );

  const entries = await setup.repository.findByTeamInRange(
    'team-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.deepEqual(entries[0], {
    entry: boundaryEntry,
    employee: { id: 'employee-id', name: 'Alex Employee' },
    task: { id: 'task-id', title: 'Implement effort view' },
    goal: { id: 'goal-id', title: 'Track delivery' },
  });
  assert.deepEqual(setup.joins, [
    [Task, 'task', 'task.id = entry.task_id'],
    [Goal, 'goal', 'goal.id = task.goal_id'],
    [User, 'employee', 'employee.id = entry.employee_id'],
  ]);
  assert.deepEqual(setup.whereClauses, [
    { clause: 'goal.team_id = :teamId', parameters: { teamId: 'team-id' } },
    {
      clause: 'entry.work_date BETWEEN :from AND :to',
      parameters: { from: '2026-08-01', to: '2026-08-07' },
    },
  ]);
  assert.deepEqual(setup.orderClauses, [
    ['employee.name', 'ASC'],
    ['entry.work_date', 'DESC'],
    ['task.title', 'ASC'],
  ]);
});

test('sumHoursByEmployeeGroupedByDate groups inclusive employee totals by work date', async () => {
  const setup = createRepository('0', [{ workDate: '2026-08-07', totalHours: '7.50' }]);

  const totals = await setup.repository.sumHoursByEmployeeGroupedByDate(
    'employee-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.deepEqual(totals, [{ workDate: '2026-08-07', totalHours: 7.5 }]);
  assert.deepEqual(setup.groupClauses, ['entry.work_date']);
  assert.deepEqual(setup.orderClauses, [['entry.work_date', 'DESC']]);
  assert.deepEqual(setup.whereClauses[1], {
    clause: 'entry.work_date BETWEEN :from AND :to',
    parameters: { from: '2026-08-01', to: '2026-08-07' },
  });
});

test('sumHoursByEmployeeGroupedByTask joins task and groups employee totals in SQL', async () => {
  const setup = createRepository('0', [
    { taskId: 'task-id', taskTitle: 'Implement history', totalHours: '9.25' },
  ]);

  const totals = await setup.repository.sumHoursByEmployeeGroupedByTask(
    'employee-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.deepEqual(totals, [
    { taskId: 'task-id', taskTitle: 'Implement history', totalHours: 9.25 },
  ]);
  assert.deepEqual(setup.joins, [[Task, 'task', 'task.id = entry.task_id']]);
  assert.deepEqual(setup.groupClauses, ['entry.task_id', 'task.title']);
  assert.deepEqual(setup.orderClauses, [['task.title', 'ASC']]);
  assert.deepEqual(setup.whereClauses[0], {
    clause: 'entry.employee_id = :employeeId',
    parameters: { employeeId: 'employee-id' },
  });
});
