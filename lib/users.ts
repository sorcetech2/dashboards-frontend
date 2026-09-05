import 'server-only';

import {
  normalizeUsername,
  type Tenant,
  type UserRecord
} from './users/schema';
import { getUserStore } from './users/store';
import { verifyDummyPassword, verifyPassword } from './users/passwords';

// Sanitized principal. This is the ONLY user shape returned by this facade;
// password hashes, salts, object keys, and storage metadata never cross it.
export interface Principal {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'viewer';
  tenantId: string;
  enabled: boolean;
  authVersion: number;
}

export interface PrincipalAuthState {
  id: string;
  role: 'admin' | 'viewer';
  tenantId: string;
  enabled: boolean;
  authVersion: number;
}

export interface ResolvedPrincipal {
  principal: Principal;
  tenant: Tenant;
}

function toPrincipal(user: UserRecord): Principal {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    tenantId: user.tenantId,
    enabled: user.enabled,
    authVersion: user.authVersion
  };
}

function toAuthState(user: UserRecord): PrincipalAuthState {
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId,
    enabled: user.enabled,
    authVersion: user.authVersion
  };
}

/**
 * Authenticate against the current authoritative snapshot. All failure
 * classes intentionally collapse to null for the caller, while unavailable
 * or invalid registry data fails closed.
 */
export async function validateUser(
  username: unknown,
  password: unknown
): Promise<Principal | null> {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > 200 ||
    password.length > 200
  ) {
    return null;
  }

  const normalized = normalizeUsername(username);
  let user: UserRecord | undefined;
  try {
    const snapshot = await getUserStore().load();
    user = snapshot.registry.users.find(
      (candidate) => candidate.username === normalized
    );
  } catch {
    // Keep unknown-user timing behaviour even when the registry is unavailable
    // and do not disclose configuration, parse, or IAM failures to the login.
    verifyDummyPassword(password);
    return null;
  }

  if (!user) {
    verifyDummyPassword(password);
    return null;
  }

  const passwordMatches = verifyPassword(password, user.password);
  if (!user.enabled || !passwordMatches) return null;
  return toPrincipal(user);
}

export async function findUserByName(
  name: string | undefined | null
): Promise<Principal | null> {
  if (typeof name !== 'string' || name.length === 0) return null;
  try {
    const user = await getUserStore().findUserByName(name);
    return user ? toPrincipal(user) : null;
  } catch {
    return null;
  }
}

export async function findUserById(
  id: string | undefined | null
): Promise<Principal | null> {
  if (typeof id !== 'string' || id.length === 0) return null;
  try {
    const user = await getUserStore().findUserById(id);
    return user ? toPrincipal(user) : null;
  } catch {
    return null;
  }
}

/**
 * Authoritative state used by protected operations for authVersion checks.
 * Registry read failures propagate so callers can tell an outage apart from a
 * user that no longer exists; only the latter is a revocation.
 */
export async function getUserAuthStateById(
  id: string | undefined | null
): Promise<PrincipalAuthState | null> {
  if (typeof id !== 'string' || id.length === 0) return null;
  const user = await getUserStore().findUserById(id);
  return user ? toAuthState(user) : null;
}

/**
 * Resolve a session principal and its tenant from one authoritative snapshot.
 * The supplied claims are compared to current id/enabled/authVersion/role/
 * tenant state, so callers can both authorize and obtain the private object
 * key without two registry reads. A canonical Principal is returned rather
 * than echoing stale session display fields.
 */
export async function resolvePrincipal(
  supplied: Principal | null | undefined
): Promise<ResolvedPrincipal | null> {
  if (
    !supplied ||
    typeof supplied.id !== 'string' ||
    typeof supplied.username !== 'string' ||
    typeof supplied.tenantId !== 'string' ||
    typeof supplied.authVersion !== 'number' ||
    (supplied.role !== 'admin' && supplied.role !== 'viewer')
  ) {
    return null;
  }

  try {
    const snapshot = await getUserStore().load();
    const user = snapshot.registry.users.find(
      (candidate) => candidate.id === supplied.id
    );
    if (
      !user ||
      !user.enabled ||
      user.username !== supplied.username ||
      user.enabled !== supplied.enabled ||
      user.authVersion !== supplied.authVersion ||
      user.role !== supplied.role ||
      user.tenantId !== supplied.tenantId
    ) {
      return null;
    }

    const tenant = snapshot.registry.tenants.find(
      (candidate) => candidate.id === user.tenantId
    );
    if (!tenant || !tenant.enabled) return null;
    return { principal: toPrincipal(user), tenant };
  } catch {
    return null;
  }
}

// Name retained for the dashboard data service's explicit authorized-tenant
// boundary. It is an alias, not a second implementation or registry read.
export const resolvePrincipalTenant = resolvePrincipal;

export async function listUsers(): Promise<Principal[]> {
  const users = await getUserStore().listUsers();
  return users.map(toPrincipal);
}

export async function isAdmin(
  name: string | undefined | null
): Promise<boolean> {
  const user = await findUserByName(name);
  return user?.role === 'admin';
}

/**
 * Resolve the server-side tenant descriptor for a principal. This function is
 * intentionally separate from Principal because object keys must never be
 * sent to the browser or embedded in an Auth.js token.
 */
export async function findTenantForPrincipal(
  principal: Pick<Principal, 'tenantId'>
): Promise<Tenant | null> {
  try {
    const snapshot = await getUserStore().load();
    return (
      snapshot.registry.tenants.find(
        (tenant) => tenant.id === principal.tenantId
      ) ?? null
    );
  } catch {
    return null;
  }
}

// Server-only callers can provide a store in pure tests without exporting
// stored user data from this facade.
export type { UserStore, UserRegistrySnapshot } from './users/store';
