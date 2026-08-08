import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { TaskStatus } from '../tasks/tasks.entity';
import { AllocationRepository } from './allocation.repository';

interface QueryCall {
  sql: string;
  parameters: unknown[];
}

function createRepository(rows: Array<Record<string, string>>) {
  const queryCalls: QueryCall[] = [];
  const dataSource = {
    async query(sql: string, parameters: unknown[]) {
      queryCalls.push({ sql, parameters });
      return rows;
    },
  } as unknown as DataSource;

  return {
    repository: new AllocationRepository(dataSource),
    queryCalls,
  };
}

test('getEmployeeWorkloadData maps workload aggregates to numbers', async () => {
  const setup = createRepository([
    {
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: '40',
      activeTaskCount: '5',
      estimatedHoursOnActiveTasks: '42',
      recordedHours: '30.5',
      completedTaskCount: '2',
      overdueTaskCount: '1',
    },
  ]);

  const rows = await setup.repository.getEmployeeWorkloadData(
    'team-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.deepEqual(rows, [
    {
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: 40,
      activeTaskCount: 5,
      estimatedHoursOnActiveTasks: 42,
      recordedHours: 30.5,
      completedTaskCount: 2,
      overdueTaskCount: 1,
    },
  ]);
});

test('getEmployeeWorkloadData keeps employees without tasks or entries', async () => {
  const setup = createRepository([
    {
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '0',
      estimatedHoursOnActiveTasks: '0',
      recordedHours: '0',
      completedTaskCount: '0',
      overdueTaskCount: '0',
    },
  ]);

  const [sam] = await setup.repository.getEmployeeWorkloadData(
    'team-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.equal(sam.activeTaskCount, 0);
  assert.equal(sam.estimatedHoursOnActiveTasks, 0);
  assert.equal(sam.recordedHours, 0);
});

test('getEmployeeWorkloadData runs one left-joined aggregate query for every member', async () => {
  const setup = createRepository([
    {
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: '40',
      activeTaskCount: '5',
      estimatedHoursOnActiveTasks: '42',
      recordedHours: '30',
      completedTaskCount: '1',
      overdueTaskCount: '1',
    },
    {
      employeeId: 'priya-id',
      employeeName: 'Priya',
      weeklyCapacityHours: '40',
      activeTaskCount: '3',
      estimatedHoursOnActiveTasks: '28',
      recordedHours: '22',
      completedTaskCount: '2',
      overdueTaskCount: '0',
    },
    {
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '1',
      estimatedHoursOnActiveTasks: '8',
      recordedHours: '6',
      completedTaskCount: '0',
      overdueTaskCount: '0',
    },
  ]);

  const rows = await setup.repository.getEmployeeWorkloadData(
    'team-id',
    '2026-08-01',
    '2026-08-07',
  );

  assert.equal(rows.length, 3);
  assert.equal(setup.queryCalls.length, 1);

  const [{ sql, parameters }] = setup.queryCalls;
  assert.match(sql, /FROM team_members membership/);
  assert.match(sql, /LEFT JOIN task_metrics/);
  assert.match(sql, /LEFT JOIN timesheet_metrics/);
  assert.match(sql, /task\.status <> \$4/);
  assert.match(sql, /task\.due_date < CURRENT_DATE AND task\.status <> \$4/);
  assert.match(sql, /entry\.work_date BETWEEN \$2 AND \$3/);
  assert.deepEqual(parameters, ['team-id', '2026-08-01', '2026-08-07', TaskStatus.DONE]);
});
