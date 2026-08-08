import { HealthRepository } from './health.repository';

export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

/**
 * Establishes the service pattern: a service receives its repository by constructor injection
 * and never touches the DataSource itself. There is no domain logic here yet — it only maps a
 * connectivity result into the shape the controller reports.
 */
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async getStatus(): Promise<HealthStatus> {
    const databaseUp = await this.healthRepository.checkConnection();
    return {
      status: databaseUp ? 'ok' : 'error',
      database: databaseUp ? 'up' : 'down',
    };
  }
}
