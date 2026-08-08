import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../common/config/constants';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../modules/users/users.entity';
import { UserRepository } from '../modules/users/users.repository';

const SEED_PASSWORD = 'TrackIt123!';

const seededUsers = [
  { email: 'admin@trackit.local', name: 'TrackIt Admin', role: UserRole.SUPER_ADMIN },
  { email: 'lead@trackit.local', name: 'TrackIt Team Lead', role: UserRole.TEAM_LEAD },
  { email: 'employee@trackit.local', name: 'TrackIt Employee', role: UserRole.EMPLOYEE },
];

async function seedUsers(): Promise<void> {
  await AppDataSource.initialize();
  const userRepository = new UserRepository(AppDataSource);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS);
  let createdUsers = 0;

  for (const seededUser of seededUsers) {
    const existingUser = await userRepository.findByEmail(seededUser.email);
    if (existingUser) {
      continue;
    }

    const user = new User();
    user.email = seededUser.email;
    user.passwordHash = passwordHash;
    user.name = seededUser.name;
    user.role = seededUser.role;
    await userRepository.save(user);
    createdUsers += 1;
  }

  console.log(
    `Created ${createdUsers} users; ${seededUsers.length} simulation users are ready. ` +
      'See README.md for credentials.',
  );
}

seedUsers()
  .catch((error) => {
    console.error('Failed to seed users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
