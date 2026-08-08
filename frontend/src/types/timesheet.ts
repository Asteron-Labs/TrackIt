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
