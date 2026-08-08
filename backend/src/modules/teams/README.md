# Teams module

The teams module owns team identity and the lead relationship. TRACKIT-14 introduces only the
reads required to enforce team scope; team management endpoints belong to later stories.

## Invariants

- A team name is unique.
- A team has one lead, or no lead while it is being configured.
- Team scope is checked with a database existence query.

## Public service methods

- `TeamsService.isLedBy(userId, teamId)` reports whether the user leads the requested team.
