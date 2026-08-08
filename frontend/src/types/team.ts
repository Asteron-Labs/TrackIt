import type { UserRole } from './auth';

export interface Team {
  id: string;
  name: string;
  description: string;
  leadId: string | null;
  weeklyCapacityHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  joinedAt: string;
}

export interface TeamDetails extends Team {
  lead: TeamMember | null;
  members: TeamMember[];
  memberCount: number;
}

export interface TeamsResponse {
  teams: Team[];
}

export interface TeamResponse {
  team: Team;
}

export interface TeamDetailsResponse {
  team: TeamDetails;
}

export interface TeamMemberResponse {
  member: TeamMember;
}

export interface TeamLeadResponse {
  lead: TeamMember;
}
