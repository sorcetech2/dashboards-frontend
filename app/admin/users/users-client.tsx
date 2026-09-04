'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  changeAccess,
  createUser,
  resetPassword,
  setEnabled,
  type AdminActionResult
} from './actions';

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'viewer';
  tenantId: string;
  tenantName: string;
  enabled: boolean;
  updatedAt: string;
}

export interface AdminTenant {
  id: string;
  displayName: string;
  enabled: boolean;
}

type ServerAction = (formData: FormData) => Promise<AdminActionResult>;

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString();
}

function ActionMessage({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={
        result.ok
          ? 'text-sm text-emerald-400'
          : result.partialSuccess
            ? 'text-sm text-amber-400'
            : 'text-sm text-red-400'
      }
    >
      {result.message}
    </p>
  );
}

function useAdminAction() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null
  );

  async function submit(action: ServerAction, formData: FormData) {
    setIsPending(true);
    try {
      const nextResult = await action(formData);
      setResult(nextResult);
      if (nextResult.generatedPassword) {
        setGeneratedPassword(nextResult.generatedPassword);
      }
      if (nextResult.ok || nextResult.partialSuccess) router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  function onSubmit(action: ServerAction) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit(action, new FormData(event.currentTarget));
    };
  }

  return {
    generatedPassword,
    isPending,
    onSubmit,
    result,
    setGeneratedPassword
  };
}

export function AdminUsersClient({
  users,
  tenants
}: {
  users: AdminUser[];
  tenants: AdminTenant[];
}) {
  const action = useAdminAction();
  const enabledTenants = tenants.filter((tenant) => tenant.enabled);

  return (
    <div className="space-y-6">
      <ActionMessage result={action.result} />
      {action.generatedPassword && (
        <Card className="border-emerald-500/50 bg-emerald-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Copy this password now</CardTitle>
            <CardDescription>
              It is displayed once and is not persisted or included in the audit
              record.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="rounded bg-background px-3 py-2 text-sm tracking-wide">
              {action.generatedPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (action.generatedPassword) {
                  void navigator.clipboard?.writeText(action.generatedPassword);
                }
              }}
            >
              Copy
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => action.setGeneratedPassword(null)}
            >
              Hide
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
          <CardDescription>
            New users are added to an existing enabled tenant with a generated
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enabledTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enabled tenants are available.
            </p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={action.onSubmit(createUser)}
            >
              <div className="space-y-2">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  name="username"
                  autoComplete="off"
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-display-name">Display name</Label>
                <Input
                  id="new-display-name"
                  name="displayName"
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <select
                  id="new-role"
                  name="role"
                  defaultValue="viewer"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-tenant">Tenant</Label>
                <select
                  id="new-tenant"
                  name="tenantId"
                  required
                  defaultValue={enabledTenants[0]?.id}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {enabledTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={action.isPending}>
                  Create user
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard users</CardTitle>
          <CardDescription>
            {users.length} account{users.length === 1 ? '' : 's'} in the
            registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="min-w-72">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    tenants={tenants}
                    action={action}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({
  user,
  tenants,
  action
}: {
  user: AdminUser;
  tenants: AdminTenant[];
  action: ReturnType<typeof useAdminAction>;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.displayName}</div>
        <div className="text-xs text-muted-foreground">{user.username}</div>
      </TableCell>
      <TableCell>
        <form
          className="flex min-w-64 flex-wrap gap-2"
          onSubmit={action.onSubmit(changeAccess)}
        >
          <input type="hidden" name="userId" value={user.id} />
          <select
            name="role"
            defaultValue={user.role}
            aria-label={`${user.username} role`}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Administrator</option>
          </select>
          <select
            name="tenantId"
            defaultValue={user.tenantId}
            aria-label={`${user.username} tenant`}
            className="h-9 max-w-44 rounded-md border border-input bg-background px-2 text-xs"
          >
            {tenants.map((tenant) => (
              <option
                key={tenant.id}
                value={tenant.id}
                disabled={!tenant.enabled}
              >
                {tenant.displayName}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={action.isPending}
          >
            Save
          </Button>
        </form>
        <div className="mt-1 text-xs text-muted-foreground">
          {user.tenantName}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={user.enabled ? 'secondary' : 'outline'}>
          {user.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(user.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex min-w-64 flex-wrap gap-2">
          <form onSubmit={action.onSubmit(setEnabled)}>
            <input type="hidden" name="userId" value={user.id} />
            <input
              type="hidden"
              name="enabled"
              value={user.enabled ? 'false' : 'true'}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={action.isPending}
            >
              {user.enabled ? 'Disable' : 'Enable'}
            </Button>
          </form>
          <form onSubmit={action.onSubmit(resetPassword)}>
            <input type="hidden" name="userId" value={user.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={action.isPending}
            >
              Reset password
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}
