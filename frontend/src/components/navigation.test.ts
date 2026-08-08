import assert from 'node:assert/strict';
import test from 'node:test';
import { menuItemsByRole, roleLabels } from './role-navigation.ts';

test('each role has its own navigation menu and human-readable label', () => {
  assert.deepEqual(menuItemsByRole.SUPER_ADMIN, [
    'Users',
    'Teams',
    'Goals and Tasks',
    'Timesheets',
    'Company Dashboard',
  ]);
  assert.deepEqual(menuItemsByRole.TEAM_LEAD, [
    'My Team',
    'Goals and Tasks',
    'Team Timesheets',
    'Team Dashboard',
  ]);
  assert.deepEqual(menuItemsByRole.EMPLOYEE, ['My Tasks', 'My Timesheets']);
  assert.deepEqual(roleLabels, {
    SUPER_ADMIN: 'Super Admin',
    TEAM_LEAD: 'Team Lead',
    EMPLOYEE: 'Employee',
  });
});
