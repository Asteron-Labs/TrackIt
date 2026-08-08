import { DataSource, FindOptionsWhere, IsNull } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { User, UserRole } from './users.entity';

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  teamId: string | null;
}

export interface UserFilter {
  role?: UserRole;
  unassigned?: boolean;
}

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

  async create(userRecord: CreateUserRecord): Promise<User> {
    const user = this.repo.create(userRecord);
    return this.repo.save(user);
  }

  findAll(filter: UserFilter): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};

    if (filter.role) {
      where.role = filter.role;
    }
    if (filter.unassigned) {
      where.teamId = IsNull();
    }

    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.repo.existsBy({ email });
  }

  isMemberOfTeam(userId: string, teamId: string): Promise<boolean> {
    return this.repo.existsBy({ id: userId, teamId });
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
