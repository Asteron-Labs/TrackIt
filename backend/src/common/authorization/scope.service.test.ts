import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenError } from '../errors';
import { TeamRepository } from '../../modules/teams/teams.repository';
import { TeamsService } from '../../modules/teams/teams.service';
import { UserRepository } from '../../modules/users/users.repository';
import { UsersService } from '../../modules/users/users.service';
import { ScopeService } from './scope.service';

function createScopeService(leadsTeam: boolean, belongsToTeam: boolean): ScopeService {
  const teamRepository = {
    isLedBy: async () => leadsTeam,
  } as unknown as TeamRepository;
  const userRepository = {
    isMemberOfTeam: async () => belongsToTeam,
  } as unknown as UserRepository;

  return new ScopeService(new TeamsService(teamRepository), new UsersService(userRepository));
}

function isForbidden(error: unknown): boolean {
  return error instanceof ForbiddenError && error.statusCode === 403;
}

test('assertTeamLeadOf allows the lead of the requested team', async () => {
  const scopeService = createScopeService(true, false);

  await assert.doesNotReject(() => scopeService.assertTeamLeadOf('lead-id', 'team-id'));
});

test("assertTeamLeadOf rejects a lead accessing another team's scope", async () => {
  const scopeService = createScopeService(false, false);

  await assert.rejects(
    () => scopeService.assertTeamLeadOf('lead-id', 'other-team-id'),
    isForbidden,
  );
});

test('assertMemberOf allows a member of the requested team', async () => {
  const scopeService = createScopeService(false, true);

  await assert.doesNotReject(() => scopeService.assertMemberOf('employee-id', 'team-id'));
});

test('assertMemberOf rejects a user outside the requested team', async () => {
  const scopeService = createScopeService(false, false);

  await assert.rejects(
    () => scopeService.assertMemberOf('employee-id', 'other-team-id'),
    isForbidden,
  );
});

test('assertOwnsResource allows the owner', () => {
  const scopeService = createScopeService(false, false);

  assert.doesNotThrow(() => scopeService.assertOwnsResource('employee-id', 'employee-id'));
});

test('assertOwnsResource rejects a different user', () => {
  const scopeService = createScopeService(false, false);

  assert.throws(
    () => scopeService.assertOwnsResource('employee-id', 'other-employee-id'),
    isForbidden,
  );
});
