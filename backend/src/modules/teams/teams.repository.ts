import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { Team } from './teams.entity';

export class TeamRepository extends BaseRepository<Team> {
  constructor(dataSource: DataSource) {
    super(dataSource, Team);
  }

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.repo.existsBy({ id: teamId, leadId: userId });
  }
}
