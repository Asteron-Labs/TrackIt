import { DataSource } from 'typeorm';

/**
 * Connectivity check against the database. Health is a liveness probe with no table of its
 * own, so this repository issues a raw `SELECT 1` rather than wrapping an entity — it does not
 * extend `BaseRepository` (there is nothing to wrap). It exists to keep the rule that the
 * repository is the only layer that touches the DataSource.
 */
export class HealthRepository {
  constructor(private readonly dataSource: DataSource) {}

  async checkConnection(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
