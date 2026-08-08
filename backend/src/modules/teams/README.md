# Teams module

The teams module owns team identity, weekly capacity, membership views, and the lead
relationship. Teams are created before leads or members are assigned.

## Invariants

- A team name is unique.
- A team has one lead, or no lead while it is being configured.
- A team can have no members while it is being configured.
- An employee belongs to at most one team.
- A team lead must also be a member of the team they lead.
- A current lead cannot be removed until a replacement is assigned.
- Weekly capacity defaults to 40 hours.
- Team scope is checked with a database existence query.
- Team lists and details apply caller scope in their database queries.

## Public service methods

- `TeamsService.createTeam(dto)` creates an empty team and rejects duplicate names.
- `TeamsService.listTeams(caller)` lists every team visible to the caller.
- `TeamsService.getTeamDetails(teamId, caller)` returns the lead, members, and member count for
  a visible team.
- `TeamsService.isLedBy(userId, teamId)` reports whether the user leads the requested team.
