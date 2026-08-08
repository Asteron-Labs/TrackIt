import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../common/config/constants';
import { ConflictError } from '../../common/errors';
import { User, UserRole } from './users.entity';
import { UserFilter, UserRepository } from './users.repository';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserProjection {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
}

export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async createUser(dto: CreateUserDto): Promise<UserProjection> {
    const emailExists = await this.userRepository.existsByEmail(dto.email);
    if (emailExists) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      teamId: null,
    });

    return this.toProjection(user);
  }

  async listUsers(filter: UserFilter): Promise<UserProjection[]> {
    const users = await this.userRepository.findAll(filter);
    return users.map((user) => this.toProjection(user));
  }

  isMemberOfTeam(userId: string, teamId: string): Promise<boolean> {
    return this.userRepository.isMemberOfTeam(userId, teamId);
  }

  private toProjection(user: User): UserProjection {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    };
  }
}
