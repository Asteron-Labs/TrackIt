import type {
  EmployeeWorkload,
  WorkloadClassification,
} from '../types/dashboard';

interface EmployeeWorkloadTableProps {
  employees: EmployeeWorkload[];
}

const workloadLabels: Record<WorkloadClassification, string> = {
  AVAILABLE: 'Available',
  BALANCED: 'Balanced',
  OVERLOADED: 'Overloaded',
};

export function EmployeeWorkloadTable({ employees }: EmployeeWorkloadTableProps) {
  if (employees.length === 0) {
    return <p className="empty-state">This team has no employees yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="workload-table">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            <th scope="col">Active tasks</th>
            <th scope="col">Estimated hours</th>
            <th scope="col">Recorded hours</th>
            <th scope="col">Workload</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.employeeId}>
              <td>{employee.employeeName}</td>
              <td>{employee.activeTaskCount}</td>
              <td>{employee.estimatedHoursOnActiveTasks}</td>
              <td>{employee.recordedHours}</td>
              <td>
                <span className={`workload-badge ${employee.workload.toLowerCase()}`}>
                  {workloadLabels[employee.workload]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
