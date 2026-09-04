/**
 * Bump when the signed session claim shape changes. Edge middleware and the
 * Node Auth.js configuration both reject tokens carrying an older/missing
 * value, which prevents legacy cookies from authorizing requests.
 */
export const AUTH_SESSION_SCHEMA_VERSION = 1;

export interface SessionClaims {
  [key: string]: unknown;
  id?: unknown;
  username?: unknown;
  tenantId?: unknown;
  role?: unknown;
  enabled?: unknown;
  authVersion?: unknown;
  sessionSchemaVersion?: unknown;
}

export interface AuthoritativeAuthState {
  id: string;
  tenantId: string;
  role: 'admin' | 'viewer';
  enabled: boolean;
  authVersion: number;
}

export function hasCurrentSessionSchema(
  claims: SessionClaims
): claims is SessionClaims & {
  sessionSchemaVersion: typeof AUTH_SESSION_SCHEMA_VERSION;
} {
  return claims.sessionSchemaVersion === AUTH_SESSION_SCHEMA_VERSION;
}

export function hasCurrentSessionClaims(
  claims: SessionClaims
): claims is SessionClaims & {
  id: string;
  username: string;
  tenantId: string;
  role: 'admin' | 'viewer';
  enabled: boolean;
  authVersion: number;
  sessionSchemaVersion: typeof AUTH_SESSION_SCHEMA_VERSION;
} {
  return (
    hasCurrentSessionSchema(claims) &&
    typeof claims.id === 'string' &&
    typeof claims.username === 'string' &&
    typeof claims.tenantId === 'string' &&
    (claims.role === 'admin' || claims.role === 'viewer') &&
    typeof claims.enabled === 'boolean' &&
    typeof claims.authVersion === 'number'
  );
}

export function matchesAuthoritativeAuthState(
  claims: SessionClaims,
  current: AuthoritativeAuthState | null
): boolean {
  return (
    hasCurrentSessionClaims(claims) &&
    current !== null &&
    current.enabled &&
    current.id === claims.id &&
    current.tenantId === claims.tenantId &&
    current.role === claims.role &&
    current.authVersion === claims.authVersion
  );
}

/**
 * Auth.js' callback type models JWTs as non-null even though its runtime
 * deliberately accepts null to clear an invalid session cookie. Keep that
 * compatibility cast in one tiny helper so every auth configuration follows
 * the same invalidation behavior.
 */
export function rejectSessionToken<T>(token: T): T {
  void token;
  return null as unknown as T;
}

/** Same runtime rejection as JWT callbacks, typed for Session callbacks. */
export function rejectSession<T = never>(value: unknown): T {
  void value;
  return null as unknown as T;
}
