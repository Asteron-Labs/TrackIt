import { User } from './users.entity';
import { UserRepository } from './users.repository';

export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  isMemberOfTeam(userId: string, teamId: string): Promise<boolean> {
    return this.userRepository.isMemberOfTeam(userId, teamId);
  }
}
