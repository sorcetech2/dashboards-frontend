import { z } from 'zod';

/**
 * Usernames are deliberately normalized at the authentication boundary.  The
 * operation is locale independent: usernames are identifiers, not display
 * text, so `toLowerCase()` is preferable to a locale-sensitive transform.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

const Base64Value = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'must be base64');

export const PasswordHashSchema = z
  .object({
    algorithm: z.literal('scrypt'),
    parametersVersion: z.literal(1),
    salt: Base64Value,
    hash: Base64Value
  })
  .strict()
  .superRefine((password, context) => {
    const salt = Buffer.from(password.salt, 'base64');
    const hash = Buffer.from(password.hash, 'base64');
    if (salt.length < 16) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salt'],
        message: 'must contain at least 16 decoded bytes'
      });
    }
    if (hash.length < 32 || hash.length > 128) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hash'],
        message: 'must contain between 32 and 128 decoded bytes'
      });
    }
  });

const IdentifierSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    'contains invalid identifier characters'
  );

const TimestampSchema = z.string().datetime({ offset: true });

export const TenantSchema = z
  .object({
    id: IdentifierSchema,
    displayName: z.string().trim().min(1).max(200),
    // This is intentionally explicit.  It keeps the existing producer's
    // object keys valid while allowing a later stable-key migration.
    dashboardObjectKey: z
      .string()
      .min(1)
      .max(1024)
      .refine(
        (key) =>
          !key.startsWith('/') &&
          !key.includes('\\') &&
          !key.split('/').some((part) => part === '..') &&
          !/[\u0000-\u001f\u007f]/.test(key),
        'contains an unsafe object key'
      ),
    enabled: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const UserRecordSchema = z
  .object({
    id: IdentifierSchema,
    username: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => value === normalizeUsername(value), {
        message:
          'must be normalized with trim plus locale-independent lowercase'
      }),
    displayName: z.string().trim().min(1).max(200),
    password: PasswordHashSchema,
    role: z.enum(['admin', 'viewer']),
    tenantId: IdentifierSchema,
    enabled: z.boolean(),
    authVersion: z.number().int().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const UserRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: TimestampSchema,
    tenants: z.array(TenantSchema).min(1),
    users: z.array(UserRecordSchema).min(1)
  })
  .strict();

export type PasswordHashRecord = z.infer<typeof PasswordHashSchema>;
export type Tenant = z.infer<typeof TenantSchema>;
export type UserRecord = z.infer<typeof UserRecordSchema>;
export type UserRegistry = z.infer<typeof UserRegistrySchema>;

export class RegistryValidationError extends Error {
  readonly code = 'REGISTRY_INVALID';

  constructor(message = 'User registry failed schema or invariant validation') {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

function assertUnique(values: string[], label: string): void {
  const unique = new Set(values);
  if (unique.size !== values.length) {
    throw new RegistryValidationError(`Duplicate ${label} in user registry`);
  }
}

/**
 * Parse and validate untrusted registry JSON.  Error messages intentionally
 * contain only structural paths/categories; never echo registry values.
 */
export function parseUserRegistry(input: unknown): UserRegistry {
  const parsed = UserRegistrySchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .filter(Boolean)
      .slice(0, 5);
    throw new RegistryValidationError(
      paths.length > 0
        ? `User registry schema error at ${paths.join(', ')}`
        : 'User registry schema error'
    );
  }

  const registry = parsed.data;
  assertUnique(
    registry.users.map((user) => user.username),
    'normalized username'
  );
  assertUnique(
    registry.users.map((user) => user.id),
    'user id'
  );
  assertUnique(
    registry.tenants.map((tenant) => tenant.id),
    'tenant id'
  );

  const tenants = new Map(
    registry.tenants.map((tenant) => [tenant.id, tenant])
  );
  for (const user of registry.users) {
    const tenant = tenants.get(user.tenantId);
    if (!tenant) {
      throw new RegistryValidationError('User references an unknown tenant');
    }
    if (user.enabled && !tenant.enabled) {
      throw new RegistryValidationError(
        'Enabled user references a disabled tenant'
      );
    }
  }

  if (!registry.users.some((user) => user.enabled && user.role === 'admin')) {
    throw new RegistryValidationError('Registry must contain an enabled admin');
  }

  return registry;
}

/**
 * Restrict a validated registry to an explicitly named account set.
 *
 * This is deliberately strict: the selection must be a non-empty comma-
 * separated list of already-normalized usernames, every name must exist, and
 * no name may occur twice.  The resulting registry is parsed again so the
 * enabled-admin and tenant-reference invariants remain in force.
 */
export function retainUsers(
  registry: UserRegistry,
  selection: string
): UserRegistry {
  const requested = selection.split(',');
  if (
    requested.length === 0 ||
    requested.some(
      (username) =>
        username.length === 0 || username !== normalizeUsername(username)
    )
  ) {
    throw new Error(
      'Retention selection must contain non-empty normalized usernames'
    );
  }

  if (new Set(requested).size !== requested.length) {
    throw new Error('Retention selection contains duplicate usernames');
  }

  const usersByUsername = new Map(
    registry.users.map((user) => [user.username, user])
  );
  const users = requested.map((username) => usersByUsername.get(username));
  if (users.some((user) => !user)) {
    throw new Error('Retention selection contains an unknown username');
  }

  const selectedUsers = users as UserRegistry['users'];
  const selectedTenantIds = new Set(selectedUsers.map((user) => user.tenantId));
  const tenants = registry.tenants.filter((tenant) =>
    selectedTenantIds.has(tenant.id)
  );

  return parseUserRegistry({
    ...registry,
    tenants,
    users: selectedUsers
  });
}
