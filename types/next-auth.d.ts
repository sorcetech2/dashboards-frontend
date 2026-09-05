import type { DefaultSession } from 'next-auth';
import 'next-auth';

type DashboardUserRole = 'admin' | 'viewer';

declare module 'next-auth' {
  interface User {
    username: string;
    displayName: string;
    role: DashboardUserRole;
    tenantId: string;
    admin: boolean;
    enabled: boolean;
    authVersion: number;
    sessionSchemaVersion: number;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      displayName: string;
      role: DashboardUserRole;
      tenantId: string;
      admin: boolean;
      enabled: boolean;
      authVersion: number;
      sessionSchemaVersion: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends Record<string, unknown> {
    id?: string;
    username?: string;
    displayName?: string;
    role?: DashboardUserRole;
    tenantId?: string;
    admin?: boolean;
    enabled?: boolean;
    authVersion?: number;
    sessionSchemaVersion?: number;
  }
}

declare module '@auth/core/jwt' {
  interface JWT extends Record<string, unknown> {
    id?: string;
    username?: string;
    displayName?: string;
    role?: DashboardUserRole;
    tenantId?: string;
    admin?: boolean;
    enabled?: boolean;
    authVersion?: number;
    sessionSchemaVersion?: number;
  }
}
