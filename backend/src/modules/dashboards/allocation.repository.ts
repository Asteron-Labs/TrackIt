import { DataSource } from 'typeorm';
import { TaskStatus } from '../tasks/tasks.entity';

export interface EmployeeWorkloadData {
  employeeId: string;
  employeeName: string;
  weeklyCapacityHours: number;
  activeTaskCount: number;
  estimatedHoursOnActiveTasks: number;
  recordedHours: number;
}

export interface TeamTaskData {
  taskId: string;
  status: TaskStatus;
  dueDate: string;
}

interface EmployeeWorkloadRow {
  employeeId: string;
  employeeName: string;
  weeklyCapacityHours: string;
  activeTaskCount: string;
  estimatedHoursOnActiveTasks: string;
  recordedHours: string;
}

export class AllocationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getEmployeeWorkloadData(
    teamId: string,
    from: string,
    to: string,
  ): Promise<EmployeeWorkloadData[]> {
    const rows = await this.dataSource.query<EmployeeWorkloadRow[]>(
      `
        WITH task_metrics AS (
          SELECT
            task.assignee_id AS employee_id,
            COUNT(*) FILTER (WHERE task.status <> $4) AS active_task_count,
            COALESCE(
              SUM(task.estimated_hours) FILTER (WHERE task.status <> $4),
              0
            ) AS estimated_hours_on_active_tasks
          FROM tasks task
          INNER JOIN goals goal ON goal.id = task.goal_id
          WHERE goal.team_id = $1 AND task.assignee_id IS NOT NULL
          GROUP BY task.assignee_id
        ),
        timesheet_metrics AS (
          SELECT
            entry.employee_id,
            COALESCE(SUM(entry.hours_spent), 0) AS recorded_hours
          FROM timesheet_entries entry
          INNER JOIN tasks task ON task.id = entry.task_id
          INNER JOIN goals goal ON goal.id = task.goal_id
          WHERE goal.team_id = $1 AND entry.work_date BETWEEN $2 AND $3
          GROUP BY entry.employee_id
        )
        SELECT
          employee.id AS "employeeId",
          employee.name AS "employeeName",
          team.weekly_capacity_hours AS "weeklyCapacityHours",
          COALESCE(task_metrics.active_task_count, 0) AS "activeTaskCount",
          COALESCE(task_metrics.estimated_hours_on_active_tasks, 0)
            AS "estimatedHoursOnActiveTasks",
          COALESCE(timesheet_metrics.recorded_hours, 0) AS "recordedHours"
        FROM team_members membership
        INNER JOIN users employee ON employee.id = membership.user_id
        INNER JOIN teams team ON team.id = membership.team_id
        LEFT JOIN task_metrics ON task_metrics.employee_id = membership.user_id
        LEFT JOIN timesheet_metrics ON timesheet_metrics.employee_id = membership.user_id
        WHERE membership.team_id = $1
        ORDER BY employee.name ASC
      `,
      [teamId, from, to, TaskStatus.DONE],
    );

    return rows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      weeklyCapacityHours: Number(row.weeklyCapacityHours),
      activeTaskCount: Number(row.activeTaskCount),
      estimatedHoursOnActiveTasks: Number(row.estimatedHoursOnActiveTasks),
      recordedHours: Number(row.recordedHours),
    }));
  }

  async getTeamTaskData(teamId: string): Promise<TeamTaskData[]> {
    const rows = await this.dataSource.query<
      Array<{ taskId: string; status: TaskStatus; dueDate: string }>
    >(
      `
        SELECT
          task.id AS "taskId",
          task.status AS "status",
          task.due_date AS "dueDate"
        FROM tasks task
        INNER JOIN goals goal ON goal.id = task.goal_id
        WHERE goal.team_id = $1
      `,
      [teamId],
    );

    return rows;
  }
}
