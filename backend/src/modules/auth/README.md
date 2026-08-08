# Auth module

The auth module proves a caller's identity. It issues signed JWTs after a successful email and
password check and restores the current safe user projection for authenticated requests.

## Invariants

- JWTs contain only `userId` and `role`, expire after 24 hours, and are signed with `JWT_SECRET`.
- Unknown emails and incorrect passwords both return `401 Invalid email or password`.
- Missing, malformed, invalid, and expired tokens return `401 Unauthorized`.
- `requireAuth` attaches the JWT identity as `req.user` with `userId` and `role`.
- `requireRole(...roles)` returns `403 Forbidden` when an authenticated role is not allowed.
- Team membership, team lead, and resource ownership checks run in services and return `403` when
  the caller is outside the requested scope.
- Refresh tokens are not part of this simulation.
- Authentication responses never include `passwordHash`.

## Public service methods

- `AuthService.login(email, password)` returns a JWT and safe user projection.
- `AuthService.getCurrentUser(userId)` returns the current safe user projection.
