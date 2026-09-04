import 'server-only';

import { redirect } from 'next/navigation';
import { auth } from './auth';
import { AUTH_SESSION_SCHEMA_VERSION } from './auth-session';
import type { Principal } from './users';

/**
 * Resolve the allow-listed identity carried by the current Auth.js session.
 * The Auth.js JWT callback has already compared these claims with the
 * authoritative registry for this request. Invalid and legacy sessions fail
 * closed and are never converted into a principal.
 */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const session = await auth();
  const user = session?.user;

  if (
    !user ||
    typeof user.id !== 'string' ||
    typeof user.username !== 'string' ||
    typeof user.displayName !== 'string' ||
    typeof user.tenantId !== 'string' ||
    (user.role !== 'admin' && user.role !== 'viewer') ||
    user.enabled !== true ||
    typeof user.authVersion !== 'number' ||
    user.sessionSchemaVersion !== AUTH_SESSION_SCHEMA_VERSION
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    tenantId: user.tenantId,
    role: user.role,
    enabled: true,
    authVersion: user.authVersion
  };
}

export async function requirePrincipal(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) redirect('/login');
  return principal;
}

export async function requireAdmin(): Promise<Principal> {
  const principal = await requirePrincipal();
  if (principal.role !== 'admin') redirect('/dashboard');
  return principal;
}
