import { RequestHandler } from 'express';

/**
 * Allows the browser frontend, which runs on a different origin in development,
 * to call the API. Sends the CORS headers on every response and short-circuits
 * the preflight (OPTIONS) request that browsers send before authenticated or
 * JSON requests.
 */
export function cors(allowedOrigin: string): RequestHandler {
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}
