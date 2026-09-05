import { describe, expect, it } from 'vitest';
import {
  createUser,
  resetUserPassword,
  setUserEnabled,
  updateUserAccess,
  UserMutationError
} from '@/lib/users/mutations';
import type { UserRegistry } from '@/lib/users/schema';

const now = '2026-09-04T10:00:00.000Z';
const password = {
  algorithm: 'scrypt' as const,
  parametersVersion: 1 as const,
  salt: 'c2FsdC1zYWx0LTE2LWJ5dGVz',
  hash: 'aGFzaC1oYXNoLWlzLWxvbmdlci10aGFuLTMydGVz'
};

function registry(): UserRegistry {
  return {
    schemaVersion: 1,
    updatedAt: now,
    tenants: [
      {
        id: 'tenant-a',
        displayName: 'Tenant A',
        dashboardObjectKey: 'companies/tenant-a.data.json',
        enabled: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'tenant-b',
        displayName: 'Tenant B',
        dashboardObjectKey: 'companies/tenant-b.data.json',
        enabled: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'tenant-disabled',
        displayName: 'Disabled Tenant',
        dashboardObjectKey: 'companies/disabled.data.json',
        enabled: false,
        createdAt: now,
        updatedAt: now
      }
    ],
    users: [
      {
        id: 'admin-a',
        username: 'admin.a',
        displayName: 'Admin A',
        password,
        role: 'admin',
        tenantId: 'tenant-a',
        enabled: true,
        authVersion: 2,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'viewer-a',
        username: 'viewer.a',
        displayName: 'Viewer A',
        password,
        role: 'viewer',
        tenantId: 'tenant-a',
        enabled: true,
        authVersion: 1,
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function expectMutationCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error('Expected mutation to fail');
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('admin user registry mutations', () => {
  it('normalizes a new username and starts its auth version at one', () => {
    const next = createUser(registry(), {
      id: 'viewer-b',
      username: '  New.User  ',
      displayName: 'New User',
      role: 'viewer',
      tenantId: 'tenant-b',
      password,
      now
    });

    expect(next.users.at(-1)).toMatchObject({
      id: 'viewer-b',
      username: 'new.user',
      tenantId: 'tenant-b',
      authVersion: 1,
      enabled: true
    });
  });

  it('rejects duplicate usernames and disabled tenants', () => {
    expect(() =>
      createUser(registry(), {
        id: 'duplicate',
        username: ' ADMIN.A ',
        displayName: 'Duplicate',
        role: 'viewer',
        tenantId: 'tenant-a',
        password,
        now
      })
    ).toThrowError(UserMutationError);
    expectMutationCode(
      () =>
        createUser(registry(), {
          id: 'disabled-tenant-user',
          username: 'new.user',
          displayName: 'New User',
          role: 'viewer',
          tenantId: 'tenant-disabled',
          password,
          now
        }),
      'TENANT_DISABLED'
    );
  });

  it('increments authVersion when disabling or changing access', () => {
    const disabled = setUserEnabled(registry(), {
      userId: 'viewer-a',
      enabled: false,
      now
    });
    expect(disabled.users.find((user) => user.id === 'viewer-a')).toMatchObject(
      {
        enabled: false,
        authVersion: 2
      }
    );

    const changed = updateUserAccess(registry(), {
      userId: 'viewer-a',
      role: 'admin',
      tenantId: 'tenant-b',
      now
    });
    expect(changed.users.find((user) => user.id === 'viewer-a')).toMatchObject({
      role: 'admin',
      tenantId: 'tenant-b',
      authVersion: 2
    });
  });

  it('protects the last enabled administrator', () => {
    expectMutationCode(
      () =>
        setUserEnabled(registry(), { userId: 'admin-a', enabled: false, now }),
      'LAST_ADMIN'
    );
    expectMutationCode(
      () =>
        updateUserAccess(registry(), {
          userId: 'admin-a',
          role: 'viewer',
          tenantId: 'tenant-a',
          now
        }),
      'LAST_ADMIN'
    );
  });

  it('changes the password and invalidates existing sessions', () => {
    const nextPassword = {
      ...password,
      hash: 'bmV3LWhhc2gtbWF0ZXJpYWwtaXMtMzI='
    };
    const next = resetUserPassword(registry(), {
      userId: 'viewer-a',
      password: nextPassword,
      now
    });
    expect(next.users.find((user) => user.id === 'viewer-a')).toMatchObject({
      password: nextPassword,
      authVersion: 2
    });
  });
});
