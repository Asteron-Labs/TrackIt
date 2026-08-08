# Users module

The users module owns user identities and exposes user reads to the auth module. User management
endpoints belong to a later story.

## Invariants

- An email identifies exactly one user.
- A user has one role: `SUPER_ADMIN`, `TEAM_LEAD`, or `EMPLOYEE`.
- Only bcrypt hashes are stored. Plaintext passwords are never entity fields or database columns.

## Public service methods

- `UsersService.findByEmail(email)` finds a user for authentication.
- `UsersService.findById(id)` finds the identity represented by a JWT.
