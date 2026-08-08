import { TeamRepository } from './teams.repository';

export class TeamsService {
  constructor(private readonly teamRepository: TeamRepository) {}

  isLedBy(userId: string, teamId: string): Promise<boolean> {
    return this.teamRepository.isLedBy(userId, teamId);
  }
}
