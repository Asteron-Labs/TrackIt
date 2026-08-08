import { ForbiddenError } from '../errors';
import { TeamsService } from '../../modules/teams/teams.service';
import { UsersService } from '../../modules/users/users.service';

export class ScopeService {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly usersService: UsersService,
  ) {}

  async assertTeamLeadOf(userId: string, teamId: string): Promise<void> {
    const leadsTeam = await this.teamsService.isLedBy(userId, teamId);
    if (!leadsTeam) {
      throw new ForbiddenError();
    }
  }

  async assertMemberOf(userId: string, teamId: string): Promise<void> {
    const belongsToTeam = await this.usersService.isMemberOfTeam(userId, teamId);
    if (!belongsToTeam) {
      throw new ForbiddenError();
    }
  }

  assertOwnsResource(userId: string, resourceOwnerId: string): void {
    if (userId !== resourceOwnerId) {
      throw new ForbiddenError();
    }
  }
}
