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
import type { UserRegistry } from '@/lib/users/schema';
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

interface AdminMutation<T> {
  /** Form keys to read; each is validated by `schema`. */
  fields: string[];
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  invalidMessage: string;
  mutate: (registry: UserRegistry, data: T) => UserRegistry;
  auditAction: (data: T) => AuditAction;
  targetId: (data: T) => string;
  successMessage: (data: T) => string;
  /** Returned to the admin on success or partial success only. */
  generatedPassword?: string;
}

/**
 * The single admin write path: authorize the actor against the registry,
 * validate the form, apply the mutation with one conditional registry write,
 * then record the audit event. A mutation that applied but could not be
 * audited is reported as a partial success so the admin does not retry it.
 */
async function runAdminMutation<T>(
  formData: FormData,
  mutation: AdminMutation<T>
): Promise<AdminActionResult> {
  const suppliedActor = await requireAdmin();
  const actor = await resolvePrincipal(suppliedActor);
  if (!actor || actor.principal.role !== 'admin') {
    return { ok: false, message: 'Administrator authorization is required.' };
  }

  const parsed = mutation.schema.safeParse(
    Object.fromEntries(
      mutation.fields.map((key) => [key, formString(formData, key)])
    )
  );
  if (!parsed.success) return { ok: false, message: mutation.invalidMessage };
  const data = parsed.data;
  const password = mutation.generatedPassword;

  try {
    await getUserStore().update((registry) => mutation.mutate(registry, data));
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  try {
    await audit(
      actor.principal.id,
      mutation.auditAction(data),
      mutation.targetId(data)
    );
  } catch (error) {
    if (error instanceof AuditWriteError) return auditFailure(password);
    return { ok: false, message: messageFor(error) };
  }
  return {
    ok: true,
    message: mutation.successMessage(data),
    ...(password ? { generatedPassword: password } : {})
  };
}

export async function createUser(
  formData: FormData
): Promise<AdminActionResult> {
  const password = generatedPassword();
  const hashedPassword = hashPassword(password);
  const userId = crypto.randomUUID();
  return runAdminMutation(formData, {
    fields: ['username', 'displayName', 'role', 'tenantId'],
    schema: z.object({
      username: Username,
      displayName: DisplayName,
      role: Role,
      tenantId: Identifier
    }),
    invalidMessage: 'Check the user details and try again.',
    mutate: (registry, data) =>
      createUserMutation(registry, {
        ...data,
        id: userId,
        password: hashedPassword,
        now: new Date().toISOString()
      }),
    auditAction: () => 'user.created',
    targetId: () => userId,
    successMessage: () =>
      'User created. Copy the generated password now; it will not be shown again.',
    generatedPassword: password
  });
}

export async function setEnabled(
  formData: FormData
): Promise<AdminActionResult> {
  return runAdminMutation(formData, {
    fields: ['userId', 'enabled'],
    schema: z.object({
      userId: Identifier,
      enabled: z.enum(['true', 'false']).transform((value) => value === 'true')
    }),
    invalidMessage: 'Check the user change and try again.',
    mutate: (registry, data) =>
      setUserEnabled(registry, {
        userId: data.userId,
        enabled: data.enabled,
        now: new Date().toISOString()
      }),
    auditAction: (data) => (data.enabled ? 'user.enabled' : 'user.disabled'),
    targetId: (data) => data.userId,
    successMessage: (data) =>
      data.enabled ? 'User enabled.' : 'User disabled.'
  });
}

export async function changeAccess(
  formData: FormData
): Promise<AdminActionResult> {
  return runAdminMutation(formData, {
    fields: ['userId', 'role', 'tenantId'],
    schema: z.object({ userId: Identifier, role: Role, tenantId: Identifier }),
    invalidMessage: 'Check the access change and try again.',
    mutate: (registry, data) =>
      updateUserAccess(registry, { ...data, now: new Date().toISOString() }),
    auditAction: () => 'user.access_changed',
    targetId: (data) => data.userId,
    successMessage: () => 'User access updated.'
  });
}

export async function resetPassword(
  formData: FormData
): Promise<AdminActionResult> {
  const password = generatedPassword();
  const hashedPassword = hashPassword(password);
  return runAdminMutation(formData, {
    fields: ['userId'],
    schema: z.object({ userId: Identifier }),
    invalidMessage: 'Check the password reset and try again.',
    mutate: (registry, data) =>
      resetUserPassword(registry, {
        userId: data.userId,
        password: hashedPassword,
        now: new Date().toISOString()
      }),
    auditAction: () => 'user.password_reset',
    targetId: (data) => data.userId,
    successMessage: () =>
      'Password reset. Copy the generated password now; it will not be shown again.',
    generatedPassword: password
  });
}
