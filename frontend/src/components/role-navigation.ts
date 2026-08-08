import type { UserRole } from "../types/auth";

export interface MenuItem {
  label: string;
  path?: string;
}

export const menuItemsByRole: Record<UserRole, MenuItem[]> = {
  SUPER_ADMIN: [
    { label: "Users", path: "/users" },
    { label: "Teams", path: "/teams" },
    { label: "Goals and Tasks", path: "/goals" },
    { label: "Timesheets" },
    { label: "Company Dashboard" },
  ],
  TEAM_LEAD: [
    { label: "My Team", path: "/teams" },
    { label: "Goals and Tasks", path: "/goals" },
    { label: "Team Timesheets" },
    { label: "Team Dashboard" },
  ],
  EMPLOYEE: [
    { label: "Team Goals", path: "/goals" },
    { label: "My Tasks" },
    { label: "My Timesheets" },
  ],
};

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};
