import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { GoalImportance, GoalStatus } from '../goals/goals.entity';
import { GoalProjection, GoalService } from '../goals/goals.service';
import { TaskStatus } from '../tasks/tasks.entity';
import { UserRole } from '../users/users.entity';
import {
  AllocationRepository,
  EmployeeWorkloadData,
  TeamTaskData,
} from './allocation.repository';
import { AllocationService, classifyWorkload } from './allocation.service';

const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';

function caller(role: UserRole): AuthenticatedUser {
  return { userId: `${role.toLowerCase()}-id`, role };
}

function activeGoal(): GoalProjection {
  return {
    id: '756aefc5-fc71-4570-b730-f6677a18ac83',
    teamId: TEAM_ID,
    title: 'Release TrackIt',
    description: 'Prepare the release.',
    startDate: '2026-08-01',
    deadline: '2026-08-31',
    status: GoalStatus.ACTIVE,
    importance: GoalImportance.HIGH,
    createdById: 'creator-id',
    progress: 50,
    noTasksYet: false,
    taskStatusBreakdown: {
      total: 2,
      todo: 0,
      inProgress: 1,
      blocked: 0,
      done: 1,
    },
    createdAt: new Date('2026-08-01T08:00:00.000Z'),
    updatedAt: new Date('2026-08-08T08:00:00.000Z'),
  };
}

function workloadData(): EmployeeWorkloadData[] {
  return [
    {
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: 40,
      activeTaskCount: 5,
      estimatedHoursOnActiveTasks: 42,
      recordedHours: 30,
    },
    {
      employeeId: 'priya-id',
      employeeName: 'Priya',
      weeklyCapacityHours: 40,
      activeTaskCount: 3,
      estimatedHoursOnActiveTasks: 28,
      recordedHours: 22,
    },
    {
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: 40,
      activeTaskCount: 0,
      estimatedHoursOnActiveTasks: 0,
      recordedHours: 0,
    },
  ];
}

function createService(
  allocationRepository: Partial<AllocationRepository> = {},
  goalService: Partial<GoalService> = {},
  scopeService: Partial<ScopeService> = {},
): AllocationService {
  return new AllocationService(
    {
      getEmployeeWorkloadData: async () => [],
      getTeamTaskData: async () => [],
      ...allocationRepository,
    } as AllocationRepository,
    {
      listTeamGoals: async () => [],
      ...goalService,
    } as GoalService,
    scopeService as ScopeService,
  );
}

test('classifyWorkload returns Available below and at 60 percent', () => {
  assert.equal(classifyWorkload(0, 40), 'AVAILABLE');
  assert.equal(classifyWorkload(8, 40), 'AVAILABLE');
  assert.equal(classifyWorkload(24, 40), 'AVAILABLE');
});

test('classifyWorkload returns Balanced above 60 and at 90 percent', () => {
  assert.equal(classifyWorkload(24.2, 40), 'BALANCED');
  assert.equal(classifyWorkload(28, 40), 'BALANCED');
  assert.equal(classifyWorkload(36, 40), 'BALANCED');
});

test('classifyWorkload returns Overloaded above 90 percent', () => {
  assert.equal(classifyWorkload(36.2, 40), 'OVERLOADED');
  assert.equal(classifyWorkload(42, 40), 'OVERLOADED');
});

test('getEmployeeWorkloads reproduces the worked example and keeps zero-task employees', async () => {
  const service = createService({ getEmployeeWorkloadData: async () => workloadData() });

  const workloads = await service.getEmployeeWorkloads(TEAM_ID, '2026-08-01', '2026-08-14');

  assert.deepEqual(
    workloads.map((employee) => ({
      name: employee.employeeName,
      activeTasks: employee.activeTaskCount,
      estimatedHours: employee.estimatedHoursOnActiveTasks,
      recordedHours: employee.recordedHours,
      utilisation: employee.utilisation,
      workload: employee.workload,
    })),
    [
      {
        name: 'Alex',
        activeTasks: 5,
        estimatedHours: 42,
        recordedHours: 30,
        utilisation: 105,
        workload: 'OVERLOADED',
      },
      {
        name: 'Priya',
        activeTasks: 3,
        estimatedHours: 28,
        recordedHours: 22,
        utilisation: 70,
        workload: 'BALANCED',
      },
      {
        name: 'Sam',
        activeTasks: 0,
        estimatedHours: 0,
        recordedHours: 0,
        utilisation: 0,
        workload: 'AVAILABLE',
      },
    ],
  );
});

test('getTeamSummary checks lead scope and combines KPIs, workloads, and active goal progress', async () => {
  const checkedTeamIds: string[] = [];
  let receivedGoalStatus: GoalStatus | undefined;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const tasks: TeamTaskData[] = [
    { taskId: 'todo-id', status: TaskStatus.TODO, dueDate: yesterday },
    { taskId: 'blocked-id', status: TaskStatus.BLOCKED, dueDate: tomorrow },
    { taskId: 'done-id', status: TaskStatus.DONE, dueDate: yesterday },
  ];
  const service = createService(
    {
      getEmployeeWorkloadData: async () => workloadData(),
      getTeamTaskData: async () => tasks,
    },
    {
      listTeamGoals: async (_teamId, filter) => {
        receivedGoalStatus = filter.status;
        return [activeGoal()];
      },
    },
    {
      assertTeamLeadOf: async (_userId, teamId) => {
        checkedTeamIds.push(teamId);
      },
    },
  );

  const summary = await service.getTeamSummary(
    TEAM_ID,
    { from: '2026-08-01', to: '2026-08-07' },
    caller(UserRole.TEAM_LEAD),
  );

  assert.deepEqual(checkedTeamIds, [TEAM_ID]);
  assert.equal(receivedGoalStatus, GoalStatus.ACTIVE);
  assert.deepEqual(summary.range, { from: '2026-08-01', to: '2026-08-07' });
  assert.deepEqual(summary.kpis, {
    activeGoals: 1,
    totalTasks: 3,
    completedTasks: 1,
    blockedTasks: 1,
    overdueTasks: 1,
  });
  assert.equal(summary.employees[0].workload, 'OVERLOADED');
  assert.equal(summary.employees[2].activeTaskCount, 0);
  assert.equal(summary.activeGoals[0].progress, 50);
});

test('getTeamSummary lets a Super Admin pass without a lead-scope assertion', async () => {
  let scopeWasChecked = false;
  const service = createService(
    {},
    {},
    {
      assertTeamLeadOf: async () => {
        scopeWasChecked = true;
      },
    },
  );

  await service.getTeamSummary(
    TEAM_ID,
    { from: '2026-08-01', to: '2026-08-07' },
    caller(UserRole.SUPER_ADMIN),
  );

  assert.equal(scopeWasChecked, false);
});

test('getTeamSummary stops before dashboard queries when team scope is rejected', async () => {
  let repositoryWasCalled = false;
  const service = createService(
    {
      getEmployeeWorkloadData: async () => {
        repositoryWasCalled = true;
        return [];
      },
    },
    {},
    {
      assertTeamLeadOf: async () => {
        throw new ForbiddenError();
      },
    },
  );

  await assert.rejects(
    () =>
      service.getTeamSummary(
        '11111111-1111-4111-8111-111111111111',
        { from: '2026-08-01', to: '2026-08-07' },
        caller(UserRole.TEAM_LEAD),
      ),
    ForbiddenError,
  );
  assert.equal(repositoryWasCalled, false);
});

test('getTeamSummary rejects a reversed range before dashboard queries', async () => {
  let repositoryWasCalled = false;
  const service = createService(
    {
      getTeamTaskData: async () => {
        repositoryWasCalled = true;
        return [];
      },
    },
    {},
    { assertTeamLeadOf: async () => undefined },
  );

  await assert.rejects(
    () =>
      service.getTeamSummary(
        TEAM_ID,
        { from: '2026-08-08', to: '2026-08-07' },
        caller(UserRole.TEAM_LEAD),
      ),
    ValidationError,
  );
  assert.equal(repositoryWasCalled, false);
});

test('getEmployeeWorkloads forwards the recorded-hours range without changing estimates', async () => {
  const calls: Array<{ teamId: string; from: string; to: string }> = [];
  const service = createService({
    getEmployeeWorkloadData: async (teamId: string, from: string, to: string) => {
      calls.push({ teamId, from, to });
      return [
        {
          employeeId: 'employee-id',
          employeeName: 'Alex',
          weeklyCapacityHours: 40,
          activeTaskCount: 2,
          estimatedHoursOnActiveTasks: 28,
          recordedHours: from === '2026-08-01' ? 5 : 12,
        },
      ];
    },
  });

  const first = await service.getEmployeeWorkloads(TEAM_ID, '2026-08-01', '2026-08-07');
  const second = await service.getEmployeeWorkloads(TEAM_ID, '2026-08-08', '2026-08-14');

  assert.deepEqual(calls, [
    { teamId: TEAM_ID, from: '2026-08-01', to: '2026-08-07' },
    { teamId: TEAM_ID, from: '2026-08-08', to: '2026-08-14' },
  ]);
  assert.equal(first[0].recordedHours, 5);
  assert.equal(second[0].recordedHours, 12);
  assert.equal(first[0].estimatedHoursOnActiveTasks, second[0].estimatedHoursOnActiveTasks);
  assert.equal(first[0].workload, second[0].workload);
});
