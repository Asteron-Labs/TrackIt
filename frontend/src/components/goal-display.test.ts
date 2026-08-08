import assert from "node:assert/strict";
import test from "node:test";
import { getGoalDeadlineDisplay, isGoalPastDeadline } from "./goal-display.ts";

test("active and planned goals are past deadline only after the deadline date", () => {
  assert.equal(isGoalPastDeadline("2026-08-07", "ACTIVE", "2026-08-08"), true);
  assert.equal(isGoalPastDeadline("2026-08-08", "ACTIVE", "2026-08-08"), false);
  assert.equal(
    isGoalPastDeadline("2026-08-09", "PLANNED", "2026-08-08"),
    false,
  );
});

test("completed and cancelled goals are not marked past deadline", () => {
  assert.equal(
    isGoalPastDeadline("2026-08-07", "COMPLETED", "2026-08-08"),
    false,
  );
  assert.equal(
    isGoalPastDeadline("2026-08-07", "CANCELLED", "2026-08-08"),
    false,
  );
});

test("deadline display reports days remaining and due today", () => {
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-09", "ACTIVE", "2026-08-08"),
    { text: "1 day remaining", overdue: false },
  );
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-10", "PLANNED", "2026-08-08"),
    { text: "2 days remaining", overdue: false },
  );
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-08", "ACTIVE", "2026-08-08"),
    { text: "Due today", overdue: false },
  );
});

test("deadline display distinguishes overdue unfinished goals", () => {
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-07", "ACTIVE", "2026-08-08"),
    { text: "1 day overdue", overdue: true },
  );
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-06", "PLANNED", "2026-08-08"),
    { text: "2 days overdue", overdue: true },
  );
});

test("completed and cancelled goals show elapsed deadline time without overdue styling", () => {
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-07", "COMPLETED", "2026-08-08"),
    { text: "Deadline passed 1 day ago", overdue: false },
  );
  assert.deepEqual(
    getGoalDeadlineDisplay("2026-08-06", "CANCELLED", "2026-08-08"),
    { text: "Deadline passed 2 days ago", overdue: false },
  );
});
