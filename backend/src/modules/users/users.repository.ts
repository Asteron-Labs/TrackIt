import { DataSource } from 'typeorm';
import { BaseRepository } from '../../common/repository/base.repository';
import { TeamMember } from '../teams/teams.entity';
import { User, UserRole } from './users.entity';

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface UserFilter {
  role?: UserRole;
  unassigned?: boolean;
}

export interface UserListRecord {
  user: User;
  teamId: string | null;
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

  async findAll(filter: UserFilter): Promise<UserListRecord[]> {
    const query = this.repo
      .createQueryBuilder('user')
      .leftJoin(TeamMember, 'membership', 'membership.user_id = user.id')
      .addSelect('membership.team_id', 'membership_team_id')
      .orderBy('user.name', 'ASC');

    if (filter.role) {
      query.andWhere('user.role = :role', { role: filter.role });
    }
    if (filter.unassigned) {
      query.andWhere('membership.id IS NULL');
    }

    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((user, index) => ({
      user,
      teamId: raw[index].membership_team_id ?? null,
    }));
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.repo.existsBy({ email });
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
