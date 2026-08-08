import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { GoalStatus } from './goals.entity';
import { GoalRepository } from './goals.repository';

interface RecordedClause {
  clause: string;
  parameters?: Record<string, unknown>;
}

function createRepository() {
  const whereClauses: RecordedClause[] = [];
  const orderClauses: Array<[string, string]> = [];
  const queryBuilder = {
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
    async getOne() {
      return null;
    },
    async getMany() {
      return [];
    },
  };
  const dataSource = {
    getRepository: () => ({ createQueryBuilder: () => queryBuilder }),
  } as unknown as DataSource;

  return {
    repository: new GoalRepository(dataSource),
    whereClauses,
    orderClauses,
  };
}

test('findByTeam scopes by team, filters by status, and orders by deadline', async () => {
  const { repository, whereClauses, orderClauses } = createRepository();

  await repository.findByTeam('team-id', { status: GoalStatus.ACTIVE });

  assert.deepEqual(whereClauses, [
    { clause: 'goal.team_id = :teamId', parameters: { teamId: 'team-id' } },
    { clause: 'goal.status = :status', parameters: { status: GoalStatus.ACTIVE } },
  ]);
  assert.deepEqual(orderClauses, [
    ['goal.deadline', 'ASC'],
    ['goal.title', 'ASC'],
  ]);
});

test('findById includes the authorized team when one is supplied', async () => {
  const { repository, whereClauses } = createRepository();

  await repository.findById('goal-id', { teamId: 'team-id' });

  assert.deepEqual(whereClauses, [
    { clause: 'goal.id = :goalId', parameters: { goalId: 'goal-id' } },
    { clause: 'goal.team_id = :accessTeamId', parameters: { accessTeamId: 'team-id' } },
  ]);
});

test('findById remains unrestricted for a Super Admin lookup', async () => {
  const { repository, whereClauses } = createRepository();

  await repository.findById('goal-id');

  assert.deepEqual(whereClauses, [
    { clause: 'goal.id = :goalId', parameters: { goalId: 'goal-id' } },
  ]);
});
