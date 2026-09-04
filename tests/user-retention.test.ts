import { describe, expect, it } from 'vitest';
import { retainUsers, type UserRegistry } from '@/lib/users/schema';

const timestamp = '2025-01-01T00:00:00.000Z';
const password = {
  algorithm: 'scrypt' as const,
  parametersVersion: 1 as const,
  salt: Buffer.alloc(16, 1).toString('base64'),
  hash: Buffer.alloc(64, 2).toString('base64')
};

const registry: UserRegistry = {
  schemaVersion: 1,
  updatedAt: timestamp,
  tenants: [
    {
      id: 'tenant-a',
      displayName: 'Tenant A',
      dashboardObjectKey: 'companies/a.data.json',
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: 'tenant-b',
      displayName: 'Tenant B',
      dashboardObjectKey: 'companies/b.data.json',
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: 'tenant-unused',
      displayName: 'Unused Tenant',
      dashboardObjectKey: 'companies/unused.data.json',
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  users: [
    {
      id: 'user-admin',
      username: 'admin',
      displayName: 'Admin',
      password,
      role: 'admin',
      tenantId: 'tenant-a',
      enabled: true,
      authVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: 'user-viewer',
      username: 'viewer',
      displayName: 'Viewer',
      password,
      role: 'viewer',
      tenantId: 'tenant-b',
      enabled: true,
      authVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
};

describe('explicit user retention', () => {
  it('retains only selected users and their referenced tenants', () => {
    const retained = retainUsers(registry, 'admin');

    expect(retained.users.map((user) => user.username)).toEqual(['admin']);
    expect(retained.tenants.map((tenant) => tenant.id)).toEqual(['tenant-a']);
  });

  it.each(['', 'admin,', 'Admin', ' admin', 'admin,admin'])(
    'rejects unsafe selection %j',
    (selection) => {
      expect(() => retainUsers(registry, selection)).toThrow();
    }
  );

  it('rejects a username that is not present', () => {
    expect(() => retainUsers(registry, 'missing')).toThrow('unknown username');
  });

  it('revalidates the enabled-admin invariant after filtering', () => {
    expect(() => retainUsers(registry, 'viewer')).toThrow('enabled admin');
  });
});
