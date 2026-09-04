import 'server-only';

import {
  normalizeUsername,
  type UserRecord,
  type UserRegistry
} from './schema';

export type UserRole = UserRecord['role'];

export class UserMutationError extends Error {
  readonly code:
    | 'DUPLICATE_USERNAME'
    | 'UNKNOWN_TENANT'
    | 'TENANT_DISABLED'
    | 'UNKNOWN_USER'
    | 'LAST_ADMIN'
    | 'INVALID_STATE';

  constructor(
    code: UserMutationError['code'],
    message = 'The requested user change could not be applied'
  ) {
    super(message);
    this.name = 'UserMutationError';
    this.code = code;
  }
}

function tenantFor(registry: UserRegistry, tenantId: string) {
  const tenant = registry.tenants.find(
    (candidate) => candidate.id === tenantId
  );
  if (!tenant) throw new UserMutationError('UNKNOWN_TENANT');
  return tenant;
}

function userFor(registry: UserRegistry, userId: string): UserRecord {
  const user = registry.users.find((candidate) => candidate.id === userId);
  if (!user) throw new UserMutationError('UNKNOWN_USER');
  return user;
}

function assertNotLastEnabledAdmin(
  registry: UserRegistry,
  user: UserRecord,
  nextRole: UserRole,
  nextEnabled: boolean
): void {
  if (
    user.role === 'admin' &&
    user.enabled &&
    (nextRole !== 'admin' || !nextEnabled) &&
    !registry.users.some(
      (candidate) =>
        candidate.id !== user.id &&
        candidate.enabled &&
        candidate.role === 'admin'
    )
  ) {
    throw new UserMutationError('LAST_ADMIN');
  }
}

function assertTenantCanHostUser(
  registry: UserRegistry,
  tenantId: string
): void {
  const tenant = tenantFor(registry, tenantId);
  if (!tenant.enabled) throw new UserMutationError('TENANT_DISABLED');
}

function updated<T extends UserRecord>(user: T, now: string): T {
  return { ...user, updatedAt: now };
}

/** Pure registry mutation for an administrator-created account. */
export function createUser(
  registry: UserRegistry,
  input: {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    tenantId: string;
    password: UserRecord['password'];
    now: string;
  }
): UserRegistry {
  const username = normalizeUsername(input.username);
  if (registry.users.some((user) => user.username === username)) {
    throw new UserMutationError('DUPLICATE_USERNAME');
  }
  assertTenantCanHostUser(registry, input.tenantId);

  const user: UserRecord = {
    id: input.id,
    username,
    displayName: input.displayName.trim(),
    password: input.password,
    role: input.role,
    tenantId: input.tenantId,
    enabled: true,
    authVersion: 1,
    createdAt: input.now,
    updatedAt: input.now
  };

  return {
    ...registry,
    users: [...registry.users, user],
    updatedAt: input.now
  };
}

/** Pure mutation for enable/disable, preserving the last-admin invariant. */
export function setUserEnabled(
  registry: UserRegistry,
  input: { userId: string; enabled: boolean; now: string }
): UserRegistry {
  const user = userFor(registry, input.userId);
  if (input.enabled) assertTenantCanHostUser(registry, user.tenantId);
  assertNotLastEnabledAdmin(registry, user, user.role, input.enabled);
  if (user.enabled === input.enabled) return registry;

  return {
    ...registry,
    users: registry.users.map((candidate) =>
      candidate.id === user.id
        ? updated(
            {
              ...candidate,
              enabled: input.enabled,
              authVersion: candidate.authVersion + 1
            },
            input.now
          )
        : candidate
    ),
    updatedAt: input.now
  };
}

/** Pure mutation for role and tenant reassignment. */
export function updateUserAccess(
  registry: UserRegistry,
  input: {
    userId: string;
    role: UserRole;
    tenantId: string;
    now: string;
  }
): UserRegistry {
  const user = userFor(registry, input.userId);
  assertTenantCanHostUser(registry, input.tenantId);
  assertNotLastEnabledAdmin(registry, user, input.role, user.enabled);

  if (user.role === input.role && user.tenantId === input.tenantId) {
    return registry;
  }

  return {
    ...registry,
    users: registry.users.map((candidate) =>
      candidate.id === user.id
        ? updated(
            {
              ...candidate,
              role: input.role,
              tenantId: input.tenantId,
              authVersion: candidate.authVersion + 1
            },
            input.now
          )
        : candidate
    ),
    updatedAt: input.now
  };
}

/** Pure mutation for a generated administrator password replacement. */
export function resetUserPassword(
  registry: UserRegistry,
  input: { userId: string; password: UserRecord['password']; now: string }
): UserRegistry {
  const user = userFor(registry, input.userId);

  return {
    ...registry,
    users: registry.users.map((candidate) =>
      candidate.id === user.id
        ? updated(
            {
              ...candidate,
              password: input.password,
              authVersion: candidate.authVersion + 1
            },
            input.now
          )
        : candidate
    ),
    updatedAt: input.now
  };
}
