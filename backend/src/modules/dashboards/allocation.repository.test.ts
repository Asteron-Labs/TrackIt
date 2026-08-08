import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { GoalStatus } from '../goals/goals.entity';
import { TaskStatus } from '../tasks/tasks.entity';
import { AllocationRepository } from './allocation.repository';

interface QueryCall {
  sql: string;
  parameters: unknown[];
}

function createRepository(rows: Array<Record<string, unknown>>) {
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
      teamId: 'team-id',
      teamName: 'Platform',
      activeGoalCount: '1',
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: '40',
      activeTaskCount: '5',
      estimatedHoursOnActiveTasks: '42',
      recordedHours: '30.5',
      tasks: [],
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
      teamId: 'team-id',
      teamName: 'Platform',
      activeGoalCount: '0',
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '0',
      estimatedHoursOnActiveTasks: '0',
      recordedHours: '0',
      tasks: [],
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
      teamId: 'team-id',
      teamName: 'Platform',
      activeGoalCount: '1',
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: '40',
      activeTaskCount: '5',
      estimatedHoursOnActiveTasks: '42',
      recordedHours: '30',
      tasks: [],
    },
    {
      teamId: 'team-id',
      teamName: 'Platform',
      activeGoalCount: '1',
      employeeId: 'priya-id',
      employeeName: 'Priya',
      weeklyCapacityHours: '40',
      activeTaskCount: '3',
      estimatedHoursOnActiveTasks: '28',
      recordedHours: '22',
      tasks: [],
    },
    {
      teamId: 'team-id',
      teamName: 'Platform',
      activeGoalCount: '1',
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '1',
      estimatedHoursOnActiveTasks: '8',
      recordedHours: '6',
      tasks: [],
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
  assert.match(sql, /FROM teams team/);
  assert.match(sql, /LEFT JOIN team_members membership/);
  assert.match(sql, /LEFT JOIN task_metrics/);
  assert.match(sql, /LEFT JOIN timesheet_metrics/);
  assert.match(sql, /task\.status <> \$5/);
  assert.match(sql, /entry\.work_date BETWEEN \$1 AND \$2/);
  assert.deepEqual(parameters, [
    '2026-08-01',
    '2026-08-07',
    'team-id',
    null,
    TaskStatus.DONE,
    GoalStatus.ACTIVE,
  ]);
});

test('getCompanyWorkloadData groups employees and task data under their teams', async () => {
  const tasks = [
    { taskId: 'task-id', status: TaskStatus.TODO, dueDate: '2026-08-10' },
  ];
  const setup = createRepository([
    {
      teamId: 'platform-id',
      teamName: 'Platform',
      activeGoalCount: '2',
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: '40',
      activeTaskCount: '2',
      estimatedHoursOnActiveTasks: '36',
      recordedHours: '12.5',
      tasks,
    },
    {
      teamId: 'platform-id',
      teamName: 'Platform',
      activeGoalCount: '2',
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: '40',
      activeTaskCount: '0',
      estimatedHoursOnActiveTasks: '0',
      recordedHours: '0',
      tasks,
    },
    {
      teamId: 'empty-id',
      teamName: 'Empty',
      activeGoalCount: '0',
      employeeId: null,
      employeeName: null,
      weeklyCapacityHours: '40',
      activeTaskCount: '0',
      estimatedHoursOnActiveTasks: '0',
      recordedHours: '0',
      tasks: [],
    },
  ]);

  const teams = await setup.repository.getCompanyWorkloadData({
    from: '2026-08-01',
    to: '2026-08-07',
  });

  assert.equal(setup.queryCalls.length, 1);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].employees.length, 2);
  assert.deepEqual(teams[0].tasks, tasks);
  assert.equal(teams[1].employees.length, 0);
});

test('getCompanyWorkloadData composes team, goal, and date filters in one query', async () => {
  const setup = createRepository([]);

  await setup.repository.getCompanyWorkloadData({
    from: '2026-08-01',
    to: '2026-08-07',
    teamId: 'team-id',
    goalId: 'goal-id',
  });

  assert.equal(setup.queryCalls.length, 1);
  const [{ sql, parameters }] = setup.queryCalls;
  assert.match(sql, /\$3::uuid IS NULL OR goal\.team_id = \$3/);
  assert.match(sql, /\$4::uuid IS NULL OR goal\.id = \$4/);
  assert.match(sql, /entry\.work_date BETWEEN \$1 AND \$2/);
  assert.deepEqual(parameters, [
    '2026-08-01',
    '2026-08-07',
    'team-id',
    'goal-id',
    TaskStatus.DONE,
    GoalStatus.ACTIVE,
  ]);
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
