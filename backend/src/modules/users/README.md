# Users module

The users module owns user identities, Super Admin user management, and user reads needed by the
auth and teams modules.

## Invariants

- An email identifies exactly one user.
- A user has one role: `SUPER_ADMIN`, `TEAM_LEAD`, or `EMPLOYEE`.
- Team membership is owned by the teams module. User listings expose the user's current team id
  when present.
- Only bcrypt hashes are stored. Plaintext passwords are never entity fields or database columns.
- User management endpoints are available only to Super Admins.
- User responses never contain `passwordHash`.

## Public service methods

- `UsersService.findByEmail(email)` finds a user for authentication.
- `UsersService.findById(id)` finds the identity represented by a JWT.
- `UsersService.createUser(dto)` rejects duplicate emails, hashes the supplied password, and
  returns the created user without the password hash.
- `UsersService.listUsers(filter)` lists users, optionally filtered by role or unassigned status.
