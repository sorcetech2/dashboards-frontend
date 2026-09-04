'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth-guards';
import { resolvePrincipal } from '@/lib/users';
import {
  AuditWriteError,
  getAuditWriter,
  newCorrelationId,
  type AuditAction
} from '@/lib/users/audit';
import {
  createUser as createUserMutation,
  resetUserPassword,
  setUserEnabled,
  updateUserAccess,
  UserMutationError
} from '@/lib/users/mutations';
import { hashPassword } from '@/lib/users/passwords';
import {
  UserStoreConflictError,
  UserStoreError,
  getUserStore
} from '@/lib/users/store';

export type AdminActionResult =
  | { ok: true; message: string; generatedPassword?: string }
  | {
      ok: false;
      message: string;
      partialSuccess?: boolean;
      generatedPassword?: string;
    };

const Identifier = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const Username = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const DisplayName = z.string().trim().min(1).max(200);
const Role = z.enum(['admin', 'viewer']);

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

function generatedPassword(): string {
  // 192 bits from the platform CSPRNG, encoded without ambiguous whitespace.
  return crypto.randomBytes(24).toString('base64url');
}

function messageFor(error: unknown): string {
  if (error instanceof UserMutationError) {
    switch (error.code) {
      case 'DUPLICATE_USERNAME':
        return 'That username is already in use.';
      case 'LAST_ADMIN':
        return 'Keep at least one enabled administrator.';
      case 'TENANT_DISABLED':
        return 'Choose an enabled tenant.';
      case 'UNKNOWN_TENANT':
        return 'That tenant is no longer available.';
      case 'UNKNOWN_USER':
        return 'That user is no longer available.';
      case 'INVALID_STATE':
        return 'This user cannot be changed in its current state.';
    }
  }
  if (error instanceof UserStoreConflictError) {
    return 'The registry changed in another session. Refresh and try again.';
  }
  if (error instanceof UserStoreError) {
    return 'The user registry is temporarily unavailable.';
  }
  return 'The requested change could not be completed.';
}

function auditFailure(password?: string): AdminActionResult {
  return {
    ok: false,
    partialSuccess: true,
    message:
      'The change was applied, but its audit record could not be written. Do not retry; contact support.',
    ...(password ? { generatedPassword: password } : {})
  };
}

async function audit(
  actorId: string,
  action: AuditAction,
  targetId: string
): Promise<void> {
  await getAuditWriter().write({
    actorId,
    action,
    targetId,
    timestamp: new Date().toISOString(),
    result: 'success',
    correlationId: newCorrelationId()
  });
}

export async function createUser(
  formData: FormData
): Promise<AdminActionResult> {
  const suppliedActor = await requireAdmin();
  const actor = await resolvePrincipal(suppliedActor);
  if (!actor || actor.principal.role !== 'admin') {
    return { ok: false, message: 'Administrator authorization is required.' };
  }

  const parsed = z
    .object({
      username: Username,
      displayName: DisplayName,
      role: Role,
      tenantId: Identifier
    })
    .safeParse({
      username: formString(formData, 'username'),
      displayName: formString(formData, 'displayName'),
      role: formString(formData, 'role'),
      tenantId: formString(formData, 'tenantId')
    });
  if (!parsed.success)
    return { ok: false, message: 'Check the user details and try again.' };

  const password = generatedPassword();
  const userId = crypto.randomUUID();
  try {
    const store = getUserStore();
    const current = await store.load();
    await store.mutate(current.etag, (registry) =>
      createUserMutation(registry, {
        ...parsed.data,
        id: userId,
        password: hashPassword(password),
        now: new Date().toISOString()
      })
    );
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  try {
    await audit(actor.principal.id, 'user.created', userId);
  } catch (error) {
    if (error instanceof AuditWriteError) return auditFailure(password);
    return { ok: false, message: messageFor(error) };
  }
  return {
    ok: true,
    message:
      'User created. Copy the generated password now; it will not be shown again.',
    generatedPassword: password
  };
}

export async function setEnabled(
  formData: FormData
): Promise<AdminActionResult> {
  const suppliedActor = await requireAdmin();
  const actor = await resolvePrincipal(suppliedActor);
  if (!actor || actor.principal.role !== 'admin') {
    return { ok: false, message: 'Administrator authorization is required.' };
  }

  const parsed = z
    .object({ userId: Identifier, enabled: z.enum(['true', 'false']) })
    .safeParse({
      userId: formString(formData, 'userId'),
      enabled: formString(formData, 'enabled')
    });
  if (!parsed.success)
    return { ok: false, message: 'Check the user change and try again.' };

  const enabled = parsed.data.enabled === 'true';
  try {
    const store = getUserStore();
    const current = await store.load();
    await store.mutate(current.etag, (registry) =>
      setUserEnabled(registry, {
        userId: parsed.data.userId,
        enabled,
        now: new Date().toISOString()
      })
    );
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  try {
    await audit(
      actor.principal.id,
      enabled ? 'user.enabled' : 'user.disabled',
      parsed.data.userId
    );
  } catch (error) {
    if (error instanceof AuditWriteError) return auditFailure();
    return { ok: false, message: messageFor(error) };
  }
  return { ok: true, message: enabled ? 'User enabled.' : 'User disabled.' };
}

export async function changeAccess(
  formData: FormData
): Promise<AdminActionResult> {
  const suppliedActor = await requireAdmin();
  const actor = await resolvePrincipal(suppliedActor);
  if (!actor || actor.principal.role !== 'admin') {
    return { ok: false, message: 'Administrator authorization is required.' };
  }

  const parsed = z
    .object({ userId: Identifier, role: Role, tenantId: Identifier })
    .safeParse({
      userId: formString(formData, 'userId'),
      role: formString(formData, 'role'),
      tenantId: formString(formData, 'tenantId')
    });
  if (!parsed.success)
    return { ok: false, message: 'Check the access change and try again.' };

  try {
    const store = getUserStore();
    const current = await store.load();
    await store.mutate(current.etag, (registry) =>
      updateUserAccess(registry, {
        ...parsed.data,
        now: new Date().toISOString()
      })
    );
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  try {
    await audit(actor.principal.id, 'user.access_changed', parsed.data.userId);
  } catch (error) {
    if (error instanceof AuditWriteError) return auditFailure();
    return { ok: false, message: messageFor(error) };
  }
  return { ok: true, message: 'User access updated.' };
}

export async function resetPassword(
  formData: FormData
): Promise<AdminActionResult> {
  const suppliedActor = await requireAdmin();
  const actor = await resolvePrincipal(suppliedActor);
  if (!actor || actor.principal.role !== 'admin') {
    return { ok: false, message: 'Administrator authorization is required.' };
  }

  const parsed = z
    .object({ userId: Identifier })
    .safeParse({ userId: formString(formData, 'userId') });
  if (!parsed.success)
    return { ok: false, message: 'Check the password reset and try again.' };

  const password = generatedPassword();
  try {
    const store = getUserStore();
    const current = await store.load();
    await store.mutate(current.etag, (registry) =>
      resetUserPassword(registry, {
        userId: parsed.data.userId,
        password: hashPassword(password),
        now: new Date().toISOString()
      })
    );
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  try {
    await audit(actor.principal.id, 'user.password_reset', parsed.data.userId);
  } catch (error) {
    if (error instanceof AuditWriteError) return auditFailure(password);
    return { ok: false, message: messageFor(error) };
  }
  return {
    ok: true,
    message:
      'Password reset. Copy the generated password now; it will not be shown again.',
    generatedPassword: password
  };
}
