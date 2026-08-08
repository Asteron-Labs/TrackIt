export interface TimesheetEntry {
  id: string;
  employeeId: string;
  taskId: string;
  workDate: string;
  hoursSpent: number;
  workNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface LogTimeRequest {
  taskId: string;
  workDate: string;
  hoursSpent: number;
  workNote?: string;
}

export interface LogTimeResponse {
  timesheetEntry: TimesheetEntry;
  dailyTotalHours: number;
}

export type EffortVarianceStatus =
  | 'UNDER_ESTIMATE'
  | 'ON_ESTIMATE'
  | 'OVER_ESTIMATE'
  | 'OVERRUN';

export interface TaskEffortEntry extends TimesheetEntry {
  employee: {
    id: string;
    name: string;
  };
}

export interface TaskEffort {
  estimatedHours: number;
  actualHours: number;
  variance: number;
  variancePercent: number | null;
  varianceStatus: EffortVarianceStatus;
  entries: TaskEffortEntry[];
}

export interface TaskEffortResponse {
  effort: TaskEffort;
}

export interface TeamTimesheetEntry extends TimesheetEntry {
  employee: {
    id: string;
    name: string;
  };
  task: {
    id: string;
    title: string;
  };
  goal: {
    id: string;
    title: string;
  };
}

export interface TeamTimesheetsResponse {
  range: {
    from: string;
    to: string;
  };
  entries: TeamTimesheetEntry[];
}
