export type UserRole = 'SUPER_ADMIN' | 'TEAM_LEAD' | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CurrentUserResponse {
  user: User;
}
