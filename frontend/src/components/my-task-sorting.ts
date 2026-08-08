import type { MyTask, TaskPriority } from "../types/task";

export type MyTaskSort = "DEADLINE" | "PRIORITY";

const priorityOrder: Record<TaskPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export function sortMyTasks(tasks: MyTask[], sort: MyTaskSort): MyTask[] {
  return [...tasks].sort((first, second) => {
    if (sort === "PRIORITY") {
      const priorityDifference =
        priorityOrder[first.priority] - priorityOrder[second.priority];
      if (priorityDifference !== 0) return priorityDifference;
    }

    return (
      first.dueDate.localeCompare(second.dueDate) ||
      first.title.localeCompare(second.title)
    );
  });
}
