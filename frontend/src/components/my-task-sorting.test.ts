import assert from "node:assert/strict";
import test from "node:test";
import type { MyTask } from "../types/task.ts";
import { sortMyTasks } from "./my-task-sorting.ts";

function myTask(
  id: string,
  dueDate: string,
  priority: MyTask["priority"],
): MyTask {
  return {
    id,
    goalId: "goal-id",
    title: id,
    status: "TODO",
    priority,
    estimatedHours: 4,
    dueDate,
    overdue: false,
    goal: { id: "goal-id", title: "Release TrackIt" },
  };
}

test("deadline sorting puts the soonest task first", () => {
  const tasks = [
    myTask("Later", "2026-09-10", "HIGH"),
    myTask("Sooner", "2026-08-20", "LOW"),
  ];

  assert.deepEqual(
    sortMyTasks(tasks, "DEADLINE").map((task) => task.id),
    ["Sooner", "Later"],
  );
});

test("priority sorting orders high, medium, then low and uses deadline as a tie-breaker", () => {
  const tasks = [
    myTask("Low", "2026-08-20", "LOW"),
    myTask("High later", "2026-09-10", "HIGH"),
    myTask("Medium", "2026-08-19", "MEDIUM"),
    myTask("High sooner", "2026-08-21", "HIGH"),
  ];

  assert.deepEqual(
    sortMyTasks(tasks, "PRIORITY").map((task) => task.id),
    ["High sooner", "High later", "Medium", "Low"],
  );
});
