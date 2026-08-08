import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors';
import { UserRole } from '../../modules/users/users.entity';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export function authenticateToken(
  authorizationHeader: string | undefined,
  jwtSecret: string,
): AuthenticatedUser {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (
      typeof payload === 'string' ||
      typeof payload.userId !== 'string' ||
      !Object.values(UserRole).includes(payload.role as UserRole)
    ) {
      throw new UnauthorizedError();
    }

    return { userId: payload.userId, role: payload.role as UserRole };
  } catch {
    throw new UnauthorizedError();
  }
}

export function requireAuth(jwtSecret: string): RequestHandler {
  return (req, _res, next) => {
    try {
      req.authenticatedUser = authenticateToken(req.get('authorization'), jwtSecret);
      next();
    } catch (error) {
      next(error);
    }
  };
}
