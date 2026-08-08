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
    },
    {
      employeeId: 'priya-id',
      employeeName: 'Priya',
      weeklyCapacityHours: '40',
      activeTaskCount: '3',
      estimatedHoursOnActiveTasks: '28',
      recordedHours: '22',
    },
    {
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '1',
      estimatedHoursOnActiveTasks: '8',
      recordedHours: '6',
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
  assert.match(sql, /entry\.work_date BETWEEN \$2 AND \$3/);
  assert.deepEqual(parameters, ['team-id', '2026-08-01', '2026-08-07', TaskStatus.DONE]);
});

test('getTeamTaskData scopes every task through its owning goal and includes unassigned tasks', async () => {
  const setup = createRepository([
    {
      taskId: 'unassigned-task-id',
      status: TaskStatus.TODO,
      dueDate: '2026-08-10',
    },
  ]);

  const rows = await setup.repository.getTeamTaskData('team-id');

  assert.deepEqual(rows, [
    {
      taskId: 'unassigned-task-id',
      status: TaskStatus.TODO,
      dueDate: '2026-08-10',
    },
  ]);
  assert.equal(setup.queryCalls.length, 1);
  assert.match(setup.queryCalls[0].sql, /INNER JOIN goals goal ON goal\.id = task\.goal_id/);
  assert.match(setup.queryCalls[0].sql, /WHERE goal\.team_id = \$1/);
  assert.doesNotMatch(setup.queryCalls[0].sql, /assignee_id/);
  assert.deepEqual(setup.queryCalls[0].parameters, ['team-id']);
});
