import { WORKLOAD_AVAILABLE_MAX, WORKLOAD_BALANCED_MAX } from '../../common/config/constants';
import { AllocationRepository, EmployeeWorkloadData } from './allocation.repository';

export type WorkloadClassification = 'AVAILABLE' | 'BALANCED' | 'OVERLOADED';

export interface EmployeeWorkload extends EmployeeWorkloadData {
  utilisation: number;
  workload: WorkloadClassification;
}

function calculateUtilisation(estimatedHours: number, capacityHours: number): number {
  return (estimatedHours / capacityHours) * 100;
}

export function classifyWorkload(
  estimatedHours: number,
  capacityHours: number,
): WorkloadClassification {
  const utilisation = calculateUtilisation(estimatedHours, capacityHours);

  if (utilisation <= WORKLOAD_AVAILABLE_MAX) return 'AVAILABLE';
  if (utilisation <= WORKLOAD_BALANCED_MAX) return 'BALANCED';
  return 'OVERLOADED';
}

export class AllocationService {
  constructor(private readonly allocationRepository: AllocationRepository) {}

  async getEmployeeWorkloads(
    teamId: string,
    from: string,
    to: string,
  ): Promise<EmployeeWorkload[]> {
    const workloadData = await this.allocationRepository.getEmployeeWorkloadData(teamId, from, to);

    return workloadData.map((employee) => ({
      ...employee,
      utilisation: calculateUtilisation(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
      workload: classifyWorkload(
        employee.estimatedHoursOnActiveTasks,
        employee.weeklyCapacityHours,
      ),
    }));
  }
}
