import assert from 'node:assert/strict';
import test from 'node:test';
import { AllocationRepository, EmployeeWorkloadData } from './allocation.repository';
import { AllocationService, classifyWorkload } from './allocation.service';

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

test('getEmployeeWorkloads reproduces the worked example', async () => {
  const workloadData: EmployeeWorkloadData[] = [
    {
      employeeId: 'alex-id',
      employeeName: 'Alex',
      weeklyCapacityHours: 40,
      activeTaskCount: 5,
      estimatedHoursOnActiveTasks: 42,
      recordedHours: 30,
      completedTaskCount: 2,
      overdueTaskCount: 1,
    },
    {
      employeeId: 'priya-id',
      employeeName: 'Priya',
      weeklyCapacityHours: 40,
      activeTaskCount: 3,
      estimatedHoursOnActiveTasks: 28,
      recordedHours: 22,
      completedTaskCount: 1,
      overdueTaskCount: 0,
    },
    {
      employeeId: 'sam-id',
      employeeName: 'Sam',
      weeklyCapacityHours: 40,
      activeTaskCount: 1,
      estimatedHoursOnActiveTasks: 8,
      recordedHours: 6,
      completedTaskCount: 0,
      overdueTaskCount: 0,
    },
  ];
  const allocationRepository = {
    getEmployeeWorkloadData: async () => workloadData,
  } as unknown as AllocationRepository;
  const service = new AllocationService(allocationRepository);

  const workloads = await service.getEmployeeWorkloads('team-id', '2026-08-01', '2026-08-14');

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
        activeTasks: 1,
        estimatedHours: 8,
        recordedHours: 6,
        utilisation: 20,
        workload: 'AVAILABLE',
      },
    ],
  );
});

test('getEmployeeWorkloads returns zero utilisation for an employee without active tasks', async () => {
  const allocationRepository = {
    getEmployeeWorkloadData: async () => [
      {
        employeeId: 'employee-id',
        employeeName: 'No Tasks',
        weeklyCapacityHours: 40,
        activeTaskCount: 0,
        estimatedHoursOnActiveTasks: 0,
        recordedHours: 0,
        completedTaskCount: 0,
        overdueTaskCount: 0,
      },
    ],
  } as unknown as AllocationRepository;
  const service = new AllocationService(allocationRepository);

  const [employee] = await service.getEmployeeWorkloads('team-id', '2026-08-01', '2026-08-07');

  assert.equal(employee.utilisation, 0);
  assert.equal(employee.workload, 'AVAILABLE');
});

test('getEmployeeWorkloads forwards the team and recorded-hours range once', async () => {
  const calls: Array<{ teamId: string; from: string; to: string }> = [];
  const allocationRepository = {
    getEmployeeWorkloadData: async (teamId: string, from: string, to: string) => {
      calls.push({ teamId, from, to });
      return [];
    },
  } as unknown as AllocationRepository;
  const service = new AllocationService(allocationRepository);

  await service.getEmployeeWorkloads('team-id', '2026-08-01', '2026-08-14');

  assert.deepEqual(calls, [
    {
      teamId: 'team-id',
      from: '2026-08-01',
      to: '2026-08-14',
    },
  ]);
});
