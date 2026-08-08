import { DataSource } from 'typeorm';
import { GoalStatus } from '../goals/goals.entity';
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

export interface CompanyWorkloadFilter {
  from: string;
  to: string;
  teamId?: string;
  goalId?: string;
}

export interface CompanyWorkloadData {
  teamId: string;
  teamName: string;
  activeGoalCount: number;
  employees: EmployeeWorkloadData[];
  tasks: TeamTaskData[];
}

interface CompanyWorkloadRow {
  teamId: string;
  teamName: string;
  activeGoalCount: string;
  employeeId: string | null;
  employeeName: string | null;
  weeklyCapacityHours: string;
  activeTaskCount: string;
  estimatedHoursOnActiveTasks: string;
  recordedHours: string;
  tasks: TeamTaskData[];
}

export class AllocationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getEmployeeWorkloadData(
    teamId: string,
    from: string,
    to: string,
  ): Promise<EmployeeWorkloadData[]> {
    const teams = await this.getCompanyWorkloadData({ teamId, from, to });
    return teams[0]?.employees ?? [];
  }

  async getCompanyWorkloadData(
    filter: CompanyWorkloadFilter,
  ): Promise<CompanyWorkloadData[]> {
    const rows = await this.dataSource.query<CompanyWorkloadRow[]>(
      `
        WITH filtered_goals AS (
          SELECT goal.id, goal.team_id, goal.status
          FROM goals goal
          WHERE ($3::uuid IS NULL OR goal.team_id = $3)
            AND ($4::uuid IS NULL OR goal.id = $4)
        ),
        task_metrics AS (
          SELECT
            goal.team_id,
            task.assignee_id AS employee_id,
            COUNT(*) FILTER (WHERE task.status <> $5) AS active_task_count,
            COALESCE(
              SUM(task.estimated_hours) FILTER (WHERE task.status <> $5),
              0
            ) AS estimated_hours_on_active_tasks
          FROM tasks task
          INNER JOIN filtered_goals goal ON goal.id = task.goal_id
          WHERE task.assignee_id IS NOT NULL
          GROUP BY goal.team_id, task.assignee_id
        ),
        timesheet_metrics AS (
          SELECT
            goal.team_id,
            entry.employee_id,
            COALESCE(SUM(entry.hours_spent), 0) AS recorded_hours
          FROM timesheet_entries entry
          INNER JOIN tasks task ON task.id = entry.task_id
          INNER JOIN filtered_goals goal ON goal.id = task.goal_id
          WHERE entry.work_date BETWEEN $1 AND $2
          GROUP BY goal.team_id, entry.employee_id
        ),
        goal_metrics AS (
          SELECT
            goal.team_id,
            COUNT(*) FILTER (WHERE goal.status = $6) AS active_goal_count
          FROM filtered_goals goal
          GROUP BY goal.team_id
        ),
        team_tasks AS (
          SELECT
            goal.team_id,
            JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'taskId', task.id,
                'status', task.status,
                'dueDate', task.due_date
              )
            ) AS tasks
          FROM tasks task
          INNER JOIN filtered_goals goal ON goal.id = task.goal_id
          GROUP BY goal.team_id
        )
        SELECT
          team.id AS "teamId",
          team.name AS "teamName",
          COALESCE(goal_metrics.active_goal_count, 0) AS "activeGoalCount",
          employee.id AS "employeeId",
          employee.name AS "employeeName",
          team.weekly_capacity_hours AS "weeklyCapacityHours",
          COALESCE(task_metrics.active_task_count, 0) AS "activeTaskCount",
          COALESCE(task_metrics.estimated_hours_on_active_tasks, 0)
            AS "estimatedHoursOnActiveTasks",
          COALESCE(timesheet_metrics.recorded_hours, 0) AS "recordedHours",
          COALESCE(team_tasks.tasks, '[]'::jsonb) AS "tasks"
        FROM teams team
        LEFT JOIN team_members membership ON membership.team_id = team.id
        LEFT JOIN users employee ON employee.id = membership.user_id
        LEFT JOIN task_metrics
          ON task_metrics.team_id = team.id
          AND task_metrics.employee_id = membership.user_id
        LEFT JOIN timesheet_metrics
          ON timesheet_metrics.team_id = team.id
          AND timesheet_metrics.employee_id = membership.user_id
        LEFT JOIN goal_metrics ON goal_metrics.team_id = team.id
        LEFT JOIN team_tasks ON team_tasks.team_id = team.id
        WHERE ($3::uuid IS NULL OR team.id = $3)
          AND (
            $4::uuid IS NULL
            OR EXISTS (
              SELECT 1 FROM filtered_goals goal WHERE goal.team_id = team.id
            )
          )
        ORDER BY team.name ASC, employee.name ASC
      `,
      [
        filter.from,
        filter.to,
        filter.teamId ?? null,
        filter.goalId ?? null,
        TaskStatus.DONE,
        GoalStatus.ACTIVE,
      ],
    );

    const teams = new Map<string, CompanyWorkloadData>();
    for (const row of rows) {
      let team = teams.get(row.teamId);
      if (!team) {
        team = {
          teamId: row.teamId,
          teamName: row.teamName,
          activeGoalCount: Number(row.activeGoalCount),
          employees: [],
          tasks: row.tasks,
        };
        teams.set(row.teamId, team);
      }

      if (row.employeeId && row.employeeName) {
        team.employees.push({
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          weeklyCapacityHours: Number(row.weeklyCapacityHours),
          activeTaskCount: Number(row.activeTaskCount),
          estimatedHoursOnActiveTasks: Number(row.estimatedHoursOnActiveTasks),
          recordedHours: Number(row.recordedHours),
        });
      }
    }

    return [...teams.values()];
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
