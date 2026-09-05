import { describe, expect, it } from 'vitest';
import {
  AUTH_SESSION_SCHEMA_VERSION,
  hasCurrentSessionClaims,
  hasCurrentSessionSchema,
  matchesAuthoritativeAuthState
} from '@/lib/auth-session';

const claims = {
  id: 'user-1',
  username: 'example',
  tenantId: 'tenant-1',
  role: 'viewer' as const,
  enabled: true,
  authVersion: 3,
  sessionSchemaVersion: AUTH_SESSION_SCHEMA_VERSION
};

describe('auth session claims', () => {
  it('rejects legacy cookies without the current schema version', () => {
    expect(hasCurrentSessionSchema({})).toBe(false);
    expect(
      hasCurrentSessionSchema({
        sessionSchemaVersion: AUTH_SESSION_SCHEMA_VERSION - 1
      })
    ).toBe(false);
    expect(hasCurrentSessionSchema(claims)).toBe(true);
  });

  it('requires the complete allow-listed claim shape', () => {
    expect(hasCurrentSessionClaims(claims)).toBe(true);
    expect(hasCurrentSessionClaims({ ...claims, tenantId: undefined })).toBe(
      false
    );
  });

  it('matches role, tenant, enabled state, and authVersion atomically', () => {
    const current = {
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'viewer' as const,
      enabled: true,
      authVersion: 3
    };
    expect(matchesAuthoritativeAuthState(claims, current)).toBe(true);
    expect(
      matchesAuthoritativeAuthState(claims, { ...current, authVersion: 4 })
    ).toBe(false);
    expect(
      matchesAuthoritativeAuthState(claims, { ...current, role: 'admin' })
    ).toBe(false);
  });
});
