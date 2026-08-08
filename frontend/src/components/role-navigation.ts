import type { UserRole } from '../types/auth';

export const menuItemsByRole: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['Users', 'Teams', 'Goals and Tasks', 'Timesheets', 'Company Dashboard'],
  TEAM_LEAD: ['My Team', 'Goals and Tasks', 'Team Timesheets', 'Team Dashboard'],
  EMPLOYEE: ['My Tasks', 'My Timesheets'],
};

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  TEAM_LEAD: 'Team Lead',
  EMPLOYEE: 'Employee',
};
