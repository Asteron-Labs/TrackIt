import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopeService } from '../../common/authorization/scope.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { AuthenticatedUser } from '../../common/middleware/authenticate';
import { UserRole } from '../users/users.entity';
import { Goal, GoalImportance, GoalStatus } from './goals.entity';
import {
  CreateGoalRecord,
  GoalAccessFilter,
  GoalFilter,
  GoalRepository,
  UpdateGoalRecord,
} from './goals.repository';
import { GoalService } from './goals.service';

const GOAL_ID = '756aefc5-fc71-4570-b730-f6677a18ac83';
const TEAM_ID = '6bf8cd4f-02af-4211-8e0e-619f888f7381';
const CREATED_AT = new Date('2026-08-08T08:00:00.000Z');

function storedGoal(overrides: Partial<Goal> = {}): Goal {
  const goal = new Goal();
  goal.id = GOAL_ID;
  goal.teamId = TEAM_ID;
  goal.title = 'Release TrackIt';
  goal.description = 'Prepare the first release.';
  goal.startDate = '2026-08-10';
  goal.deadline = '2026-09-10';
  goal.status = GoalStatus.PLANNED;
  goal.importance = GoalImportance.HIGH;
  goal.createdById = 'creator-id';
  goal.createdAt = CREATED_AT;
  goal.updatedAt = CREATED_AT;
  return Object.assign(goal, overrides);
}

function caller(role: UserRole): AuthenticatedUser {
  return { userId: `${role.toLowerCase()}-id`, role };
}

function createService(
  goalRepository: Partial<GoalRepository>,
  scopeService: Partial<ScopeService> = {},
): GoalService {
  return new GoalService(goalRepository as GoalRepository, scopeService as ScopeService);
}

test('createGoal checks Team Lead scope and creates a planned goal', async () => {
  let checkedTeamId: string | undefined;
  let createdRecord: CreateGoalRecord | undefined;
  const teamLead = caller(UserRole.TEAM_LEAD);
  const goalService = createService(
    {
      create: async (record: CreateGoalRecord) => {
        createdRecord = record;
        return storedGoal(record);
      },
    },
    {
      assertTeamLeadOf: async (_userId, teamId) => {
        checkedTeamId = teamId;
      },
    },
  );

  const goal = await goalService.createGoal(
    {
      teamId: TEAM_ID,
      title: 'Release TrackIt',
      startDate: '2026-08-10',
      deadline: '2026-09-10',
      importance: GoalImportance.HIGH,
    },
    teamLead,
  );

  assert.equal(checkedTeamId, TEAM_ID);
  assert.deepEqual(createdRecord, {
    teamId: TEAM_ID,
    title: 'Release TrackIt',
    description: '',
    startDate: '2026-08-10',
    deadline: '2026-09-10',
    status: GoalStatus.PLANNED,
    importance: GoalImportance.HIGH,
    createdById: teamLead.userId,
  });
  assert.equal(goal.progress, null);
});

test('createGoal allows a Super Admin to manage any team without a lead assertion', async () => {
  const goalService = createService(
    { create: async (record: CreateGoalRecord) => storedGoal(record) },
    {
      assertTeamLeadOf: async () => {
        throw new Error('Super Admin scope should not be checked');
      },
    },
  );

  const goal = await goalService.createGoal(
    {
      teamId: TEAM_ID,
      title: 'Release TrackIt',
      startDate: '2026-08-10',
      deadline: '2026-09-10',
      importance: GoalImportance.HIGH,
    },
    caller(UserRole.SUPER_ADMIN),
  );

  assert.equal(goal.teamId, TEAM_ID);
});

test('createGoal rejects a deadline that is not after the start date', async () => {
  const goalService = createService({}, { assertTeamLeadOf: async () => undefined });

  await assert.rejects(
    () =>
      goalService.createGoal(
        {
          teamId: TEAM_ID,
          title: 'Release TrackIt',
          startDate: '2026-09-10',
          deadline: '2026-09-10',
          importance: GoalImportance.HIGH,
        },
        caller(UserRole.TEAM_LEAD),
      ),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.message === 'Deadline must fall after the start date',
  );
});

test('createGoal rejects an Employee before persistence', async () => {
  const goalService = createService({});

  await assert.rejects(
    () =>
      goalService.createGoal(
        {
          teamId: TEAM_ID,
          title: 'Release TrackIt',
          startDate: '2026-08-10',
          deadline: '2026-09-10',
          importance: GoalImportance.HIGH,
        },
        caller(UserRole.EMPLOYEE),
      ),
    (error: unknown) => error instanceof ForbiddenError,
  );
});

test('listTeamGoals checks Employee membership and forwards the status filter', async () => {
  let checkedMemberId: string | undefined;
  let receivedFilter: GoalFilter | undefined;
  const employee = caller(UserRole.EMPLOYEE);
  const goalService = createService(
    {
      findByTeam: async (_teamId, filter) => {
        receivedFilter = filter;
        return [storedGoal({ status: GoalStatus.ACTIVE })];
      },
    },
    {
      assertMemberOf: async (userId) => {
        checkedMemberId = userId;
      },
    },
  );

  const goals = await goalService.listTeamGoals(TEAM_ID, { status: GoalStatus.ACTIVE }, employee);

  assert.equal(checkedMemberId, employee.userId);
  assert.deepEqual(receivedFilter, { status: GoalStatus.ACTIVE });
  assert.equal(goals[0].status, GoalStatus.ACTIVE);
});

test('getGoal returns the result of a team-scoped query', async () => {
  const receivedAccess: GoalAccessFilter[] = [];
  const goalService = createService(
    {
      findById: async (_goalId, access = {}) => {
        receivedAccess.push(access);
        return storedGoal();
      },
    },
    { assertTeamLeadOf: async () => undefined },
  );

  await goalService.getGoal(GOAL_ID, caller(UserRole.TEAM_LEAD));

  assert.deepEqual(receivedAccess, [{}, { teamId: TEAM_ID }]);
});

test('getGoal returns 404 when the goal does not exist', async () => {
  const goalService = createService({ findById: async () => null });

  await assert.rejects(
    () => goalService.getGoal(GOAL_ID, caller(UserRole.SUPER_ADMIN)),
    (error: unknown) => error instanceof NotFoundError,
  );
});

test('updateGoal validates dates after merging partial changes', async () => {
  const goalService = createService(
    { findById: async () => storedGoal() },
    { assertTeamLeadOf: async () => undefined },
  );

  await assert.rejects(
    () => goalService.updateGoal(GOAL_ID, { startDate: '2026-09-10' }, caller(UserRole.TEAM_LEAD)),
    (error: unknown) => error instanceof ValidationError,
  );
});

test('updateGoal persists editable fields for an authorized Team Lead', async () => {
  let updatedRecord: UpdateGoalRecord | undefined;
  const goalService = createService(
    {
      findById: async () => storedGoal(),
      update: async (_goalId, changes) => {
        updatedRecord = changes;
        return storedGoal(changes);
      },
    },
    { assertTeamLeadOf: async () => undefined },
  );

  const goal = await goalService.updateGoal(
    GOAL_ID,
    { status: GoalStatus.ACTIVE, deadline: '2026-09-20' },
    caller(UserRole.TEAM_LEAD),
  );

  assert.deepEqual(updatedRecord, {
    status: GoalStatus.ACTIVE,
    deadline: '2026-09-20',
  });
  assert.equal(goal.status, GoalStatus.ACTIVE);
});
