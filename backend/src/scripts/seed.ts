import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { TeamRepository } from '../modules/teams/teams.repository';
import { TeamsService } from '../modules/teams/teams.service';
import { UserRepository } from '../modules/users/users.repository';
import { UsersService } from '../modules/users/users.service';
import { seedCompanyStructure } from './seeds/company-structure.seed';

async function runSeed(): Promise<void> {
  await AppDataSource.initialize();

  const usersService = new UsersService(new UserRepository(AppDataSource));
  const teamsService = new TeamsService(new TeamRepository(AppDataSource), usersService);
  const result = await seedCompanyStructure(usersService, teamsService);

  console.log(
    `Seed complete: ${result.createdUsers} users, ${result.createdTeams} teams, ` +
      `${result.addedMemberships} memberships, and ${result.assignedLeads} leads created or assigned.`,
  );
}

runSeed()
  .catch((error) => {
    console.error('Failed to seed TrackIt:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
