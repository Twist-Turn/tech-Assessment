export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

export interface Assignment {
  user_id: string;
  team_id: string;
  role_id: string;
  assigned_at: string;
  profiles: { id: string; name: string; email: string };
  teams: { id: string; name: string };
  roles: { id: string; name: string };
}

export interface ResolvedPermissions {
  userId: string;
  teamId: string;
  permissions: string[];
  roles: { id: string; name: string }[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; name: string; email: string } | null;
  target: { id: string; name: string; email: string } | null;
  team: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
}
