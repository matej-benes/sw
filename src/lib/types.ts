export type Role = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  organizationId?: string;
  avatarUrl?: string;
}
