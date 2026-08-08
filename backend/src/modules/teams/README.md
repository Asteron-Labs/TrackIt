# Teams module

The teams module owns team identity, weekly capacity, membership, and the lead relationship.
Teams are created before leads or members are assigned.

## Invariants

- A team name is unique.
- A team has one lead, or no lead while it is being configured.
- A team can have no members while it is being configured.
- An employee belongs to at most one team.
- Only users with the `EMPLOYEE` role can be added as members.
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
- `TeamsService.addMember(teamId, userId)` adds an unassigned employee to a team.
- `TeamsService.assignTeamLead(teamId, userId)` promotes a member and demotes the previous lead.
- `TeamsService.removeMember(teamId, userId)` removes a member unless they are the current lead.
- `TeamsService.isLedBy(userId, teamId)` reports whether the user leads the requested team.
- `TeamsService.isMember(userId, teamId)` reports whether the user belongs to the requested team.
