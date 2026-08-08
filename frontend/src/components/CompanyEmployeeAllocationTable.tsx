import type {
  CompanyEmployeeWorkload,
  WorkloadClassification,
} from '../types/dashboard';

interface CompanyEmployeeAllocationTableProps {
  employees: CompanyEmployeeWorkload[];
}

const workloadLabels: Record<WorkloadClassification, string> = {
  AVAILABLE: 'Available',
  BALANCED: 'Balanced',
  OVERLOADED: 'Overloaded',
};

export function CompanyEmployeeAllocationTable({
  employees,
}: CompanyEmployeeAllocationTableProps) {
  if (employees.length === 0) {
    return <p className="empty-state">No employees match the selected filters.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="company-allocation-table">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            <th scope="col">Team</th>
            <th scope="col">Active tasks</th>
            <th scope="col">Estimated hours</th>
            <th scope="col">Recorded hours</th>
            <th scope="col">Utilisation</th>
            <th scope="col">Workload</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.employeeId}>
              <td>{employee.employeeName}</td>
              <td>{employee.teamName}</td>
              <td>{employee.activeTaskCount}</td>
              <td>{employee.estimatedHoursOnActiveTasks}</td>
              <td>{employee.recordedHours}</td>
              <td>{employee.utilisation.toFixed(1)}%</td>
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
