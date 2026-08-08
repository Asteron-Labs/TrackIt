import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { TimesheetRepository } from './timesheets.repository';

interface RecordedClause {
  clause: string;
  parameters?: Record<string, unknown>;
}

function createRepository(total = '0') {
  const findCalls: unknown[] = [];
  const findOneCalls: unknown[] = [];
  const whereClauses: RecordedClause[] = [];
  const queryBuilder = {
    select() {
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
    async getRawOne() {
      return { total };
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
      createQueryBuilder: () => queryBuilder,
    }),
  } as unknown as DataSource;

  return {
    repository: new TimesheetRepository(dataSource),
    findCalls,
    findOneCalls,
    whereClauses,
  };
}

test('find methods scope entries by employee, task, and date', async () => {
  const { repository, findCalls, findOneCalls } = createRepository();

  await repository.findByEmployeeAndDate('employee-id', '2026-08-07');
  await repository.findByEmployeeAndTaskAndDate('employee-id', 'task-id', '2026-08-07');
  await repository.findByTask('task-id');

  assert.deepEqual(findCalls, [
    {
      where: { employeeId: 'employee-id', workDate: '2026-08-07' },
      order: { createdAt: 'ASC' },
    },
    {
      where: { taskId: 'task-id' },
      order: { workDate: 'DESC', createdAt: 'DESC' },
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
  ]);
});

test('sumHoursByTask filters by task and converts the decimal result', async () => {
  const { repository, whereClauses } = createRepository('7.50');

  const total = await repository.sumHoursByTask('task-id');

  assert.equal(total, 7.5);
  assert.deepEqual(whereClauses, [
    { clause: 'entry.task_id = :taskId', parameters: { taskId: 'task-id' } },
  ]);
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
