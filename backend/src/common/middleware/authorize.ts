import { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { UserRole } from '../../modules/users/users.entity';

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }

    next();
  };
}
