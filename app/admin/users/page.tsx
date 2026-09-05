import { requireAdmin } from '@/lib/auth-guards';
import { DashboardHeader } from '../../dashboard/components/dashboard-header';
import { getUserStore, UserStoreError } from '@/lib/users/store';
import {
  AdminUsersClient,
  type AdminTenant,
  type AdminUser
} from './users-client';

export const dynamic = 'force-dynamic';

async function loadAdminData(): Promise<{
  users: AdminUser[];
  tenants: AdminTenant[];
}> {
  const snapshot = await getUserStore().load();
  const tenantNames = new Map(
    snapshot.registry.tenants.map((tenant) => [tenant.id, tenant.displayName])
  );
  const users: AdminUser[] = snapshot.registry.users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: tenantNames.get(user.tenantId) ?? 'Unknown tenant',
    enabled: user.enabled,
    updatedAt: user.updatedAt
  }));
  const tenants: AdminTenant[] = snapshot.registry.tenants.map((tenant) => ({
    id: tenant.id,
    displayName: tenant.displayName,
    enabled: tenant.enabled
  }));
  return { users, tenants };
}

export default async function AdminUsersPage() {
  await requireAdmin();

  let data: Awaited<ReturnType<typeof loadAdminData>>;
  try {
    data = await loadAdminData();
  } catch (error) {
    const message =
      error instanceof UserStoreError
        ? 'The user registry is temporarily unavailable.'
        : 'Users could not be loaded.';
    return (
      <div className="min-h-screen">
        <DashboardHeader isAdmin />
        <main id="main-content" className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader isAdmin />
      <main id="main-content" className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Administration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage dashboard access for existing tenants. Passwords are
            generated securely and shown only once.
          </p>
        </div>
        <AdminUsersClient users={data.users} tenants={data.tenants} />
      </main>
    </div>
  );
}
