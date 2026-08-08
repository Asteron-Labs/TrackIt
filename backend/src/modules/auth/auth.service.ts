import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from '../../common/config/constants';
import { InvalidCredentialsError, UnauthorizedError } from '../../common/errors';
import { User, UserRole } from '../users/users.entity';
import { UsersService } from '../users/users.service';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: SafeUser;
}

export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtSecret: string,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, this.jwtSecret, {
      expiresIn: JWT_EXPIRY,
    });

    return { token, user: this.toSafeUser(user) };
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    return this.toSafeUser(user);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
