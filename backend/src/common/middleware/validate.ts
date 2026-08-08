import { RequestHandler } from 'express';
import { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validation at the controller boundary (AGENTS.md: validation is a controller
 * concern, authorisation is a service concern). Parses the requested parts of the
 * request with Zod, replacing them with the parsed/typed values. Any ZodError is
 * forwarded to the centralised error handler, which renders it as a 400.
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
