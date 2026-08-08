import assert from "node:assert/strict";
import test from "node:test";
import { menuItemsByRole, roleLabels } from "./role-navigation.ts";

test("each role has its own navigation menu and human-readable label", () => {
  assert.deepEqual(menuItemsByRole.SUPER_ADMIN, [
    { label: "Users", path: "/users" },
    { label: "Teams", path: "/teams" },
    { label: "Goals and Tasks", path: "/goals" },
    { label: "Timesheets" },
    { label: "Company Dashboard", path: "/" },
  ]);
  assert.deepEqual(menuItemsByRole.TEAM_LEAD, [
    { label: "My Team", path: "/teams" },
    { label: "Goals and Tasks", path: "/goals" },
    { label: "Team Timesheets" },
    { label: "Team Dashboard", path: "/" },
  ]);
  assert.deepEqual(menuItemsByRole.EMPLOYEE, [
    { label: "Team Goals", path: "/goals" },
    { label: "My Tasks", path: "/tasks" },
    { label: "My Timesheets" },
  ]);
  assert.deepEqual(roleLabels, {
    SUPER_ADMIN: "Super Admin",
    TEAM_LEAD: "Team Lead",
    EMPLOYEE: "Employee",
  });
});
