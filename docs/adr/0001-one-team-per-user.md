# ADR 0001: One team per user

## Status

Accepted

## Context

TrackIt models membership with a `team_members` join table, which could allow a user to belong
to several teams. Weekly capacity is defined per person, so multi-team membership would require
an additional rule for splitting that capacity between teams. No current story defines such a
rule.

## Decision

A user may belong to at most one team. The database enforces this with a unique constraint on
`team_members.user_id`, in addition to the unique team-and-user membership pair.

## Consequences

- An unassigned user has no row in `team_members`.
- Adding a user who already belongs to any team is rejected.
- A person's full weekly capacity belongs to their one team.
- Supporting membership in several teams later requires a new capacity-allocation decision and
  a schema change.
