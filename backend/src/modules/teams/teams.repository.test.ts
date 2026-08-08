import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserRole } from '../users/users.entity';
import { Team } from './teams.entity';
import { TeamRepository } from './teams.repository';

interface RecordedUpdate {
  entity: unknown;
  criteria: unknown;
  partial: unknown;
}

function createRepositoryForLeadAssignment(currentLeadId: string | null) {
  const updates: RecordedUpdate[] = [];
  const queryBuilder = {
    setLock() {
      return this;
    },
    where() {
      return this;
    },
    async getOneOrFail() {
      return { leadId: currentLeadId } as Team;
    },
  };
  const manager = {
    getRepository: () => ({ createQueryBuilder: () => queryBuilder }),
    async update(entity: unknown, criteria: unknown, partial: unknown) {
      updates.push({ entity, criteria, partial });
    },
  };
  const dataSource = {
    getRepository: () => ({}),
    transaction: async (work: (entityManager: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
  } as unknown as DataSource;

  return { repository: new TeamRepository(dataSource), updates };
}

test('assignTeamLead promotes the new lead and demotes the previous lead atomically', async () => {
  const previousLeadId = 'previous-lead-id';
  const newLeadId = 'new-lead-id';
  const { repository, updates } = createRepositoryForLeadAssignment(previousLeadId);

  await repository.assignTeamLead('team-id', newLeadId);

  assert.deepEqual(updates, [
    {
      entity: User,
      criteria: previousLeadId,
      partial: { role: UserRole.EMPLOYEE },
    },
    {
      entity: User,
      criteria: newLeadId,
      partial: { role: UserRole.TEAM_LEAD },
    },
    {
      entity: Team,
      criteria: 'team-id',
      partial: { leadId: newLeadId },
    },
  ]);
});

test('assignTeamLead does not demote a user when assigning the first lead', async () => {
  const { repository, updates } = createRepositoryForLeadAssignment(null);

  await repository.assignTeamLead('team-id', 'new-lead-id');

  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0].partial, { role: UserRole.TEAM_LEAD });
  assert.deepEqual(updates[1].partial, { leadId: 'new-lead-id' });
});
