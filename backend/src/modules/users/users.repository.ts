import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { User } from './users.entity';

export class UserRepository extends BaseRepository<User> {
  constructor(dataSource: DataSource) {
    super(dataSource, User);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  isMemberOfTeam(userId: string, teamId: string): Promise<boolean> {
    return this.repo.existsBy({ id: userId, teamId });
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
