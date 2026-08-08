export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type BusinessImpact = "LOW" | "MEDIUM" | "HIGH";

export interface TaskAssignee {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
  assigneeId: string | null;
  assignee: TaskAssignee | null;
  businessImpact: BusinessImpact | null;
  priorityScore: number | null;
  overdue: boolean;
  dueDatePastGoalDeadline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}

export interface MyTask {
  id: string;
  goalId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number;
  dueDate: string;
  overdue: boolean;
  goal: {
    id: string;
    title: string;
  };
}

export interface MyTasksResponse {
  tasks: MyTask[];
}
