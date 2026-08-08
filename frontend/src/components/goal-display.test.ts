import assert from "node:assert/strict";
import test from "node:test";
import { isGoalPastDeadline } from "./goal-display.ts";

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
