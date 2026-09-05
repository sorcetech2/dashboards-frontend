import 'server-only';

import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import {
  parseUserRegistry,
  type UserRegistry,
  type UserRecord
} from './schema';

export type UserRegistrySource = 'local' | 's3';

export interface UserStoreEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  AUTH_USER_REGISTRY_SOURCE?: string;
  AUTH_USER_REGISTRY_LOCAL_PATH?: string;
  AUTH_USER_REGISTRY_BUCKET?: string;
  AUTH_USER_REGISTRY_KEY?: string;
  AUTH_USER_REGISTRY_REGION?: string;
  AWS_DEFAULT_REGION?: string;
}

export interface UserRegistrySnapshot {
  registry: UserRegistry;
  /** S3 ETag, or a deterministic local-file ETag. */
  etag: string;
}

export interface ConditionalPutInput {
  body: string;
  contentType: 'application/json';
  ifMatch: string;
}

export interface RegistryObjectBackend {
  read(): Promise<{
    body: string;
    etag?: string;
  }>;
  write(input: ConditionalPutInput): Promise<{
    etag?: string;
  }>;
}

export class UserStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'UserStoreError';
    this.code = code;
  }
}

export class UserStoreConfigurationError extends UserStoreError {
  constructor(message: string) {
    super('USER_STORE_CONFIGURATION', message);
    this.name = 'UserStoreConfigurationError';
  }
}

export class UserStoreConflictError extends UserStoreError {
  constructor(message = 'User registry changed; retry the operation') {
    super('USER_STORE_CONFLICT', message);
    this.name = 'UserStoreConflictError';
  }
}

export interface UserStoreOptions {
  backend?: RegistryObjectBackend;
  environment?: UserStoreEnvironment;
}

export function sourceFromEnvironment(
  environment: UserStoreEnvironment
): UserRegistrySource {
  const requested = environment.AUTH_USER_REGISTRY_SOURCE?.trim().toLowerCase();
  const localAllowed =
    environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test';
  if (requested === 'local') {
    if (!localAllowed) {
      throw new UserStoreConfigurationError(
        'Local auth registry is only permitted in development or test'
      );
    }
    return 'local';
  }
  if (requested === 's3') return 's3';
  return localAllowed ? 'local' : 's3';
}

function localPathFromEnvironment(environment: UserStoreEnvironment): string {
  const configured = environment.AUTH_USER_REGISTRY_LOCAL_PATH?.trim();
  // Keep the local fallback dynamic so Next's output-file tracer cannot copy a
  // developer's ignored registry into a production server bundle.  The path
  // remains the familiar <repo>/lib/user-registry.json at runtime.
  const fallback = Buffer.from('dXNlci1yZWdpc3RyeS5qc29u', 'base64').toString(
    'utf8'
  );
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), 'lib', fallback);
}

function localETag(body: string): string {
  return `"${crypto.createHash('md5').update(body).digest('hex')}"`;
}

class LocalRegistryBackend implements RegistryObjectBackend {
  constructor(private readonly filePath: string) {}

  async read(): Promise<{ body: string; etag: string }> {
    try {
      const body = await fs.readFile(this.filePath, 'utf8');
      return { body, etag: localETag(body) };
    } catch {
      throw new UserStoreError(
        'USER_STORE_UNAVAILABLE',
        'Local auth registry could not be read'
      );
    }
  }

  async write(input: ConditionalPutInput): Promise<{ etag: string }> {
    const current = await this.read();
    if (current.etag !== input.ifMatch) {
      throw new UserStoreConflictError();
    }

    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    try {
      await fs.writeFile(temporaryPath, input.body, {
        encoding: 'utf8',
        mode: 0o600
      });
      await fs.rename(temporaryPath, this.filePath);
      return { etag: localETag(input.body) };
    } catch {
      try {
        await fs.unlink(temporaryPath);
      } catch {
        // Best effort cleanup.  Do not replace the original failure with a
        // filesystem detail that could disclose a local path.
      }
      throw new UserStoreError(
        'USER_STORE_WRITE_FAILED',
        'Local auth registry could not be written'
      );
    }
  }
}

export interface S3RegistryBackendOptions {
  client?: S3Client;
}

export interface S3RegistryBackendConfig extends S3RegistryBackendOptions {
  bucket: string;
  key: string;
  region: string;
}

class S3RegistryBackend implements RegistryObjectBackend {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly key: string,
    region: string,
    client?: S3Client
  ) {
    this.client = client ?? new S3Client({ region });
  }

  async read(): Promise<{ body: string; etag?: string }> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key
        })
      );
      if (!response.Body) {
        throw new Error('missing body');
      }
      return {
        body: await response.Body.transformToString(),
        etag: response.ETag
      };
    } catch {
      throw new UserStoreError(
        'USER_STORE_UNAVAILABLE',
        'S3 auth registry could not be read'
      );
    }
  }

  async write(input: ConditionalPutInput): Promise<{ etag?: string }> {
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.key,
          Body: input.body,
          ContentType: input.contentType,
          IfMatch: input.ifMatch
        })
      );
      return { etag: response.ETag };
    } catch (error) {
      const status = getHttpStatus(error);
      if (status === 409 || status === 412) {
        throw new UserStoreConflictError();
      }
      throw new UserStoreError(
        'USER_STORE_WRITE_FAILED',
        'S3 auth registry could not be written'
      );
    }
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('$metadata' in error) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata;
    if (metadata?.httpStatusCode) return metadata.httpStatusCode;
  }
  if ('statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return undefined;
}

/** Factory kept public so tests can inject a client without exposing registry
 * implementation details to client code. */
export function createS3RegistryBackend(
  config: S3RegistryBackendConfig
): RegistryObjectBackend {
  return new S3RegistryBackend(
    config.bucket,
    config.key,
    config.region,
    config.client
  );
}

export function createUserStore(options: UserStoreOptions = {}): UserStore {
  if (options.backend) return new UserStore(options.backend);

  const environment = options.environment ?? process.env;
  const source = sourceFromEnvironment(environment);
  if (source === 'local') {
    return new UserStore(
      new LocalRegistryBackend(localPathFromEnvironment(environment))
    );
  }

  // Keep the existing data bucket as the safe deployment default while still
  // allowing a dedicated private bucket to be selected explicitly.
  const configuredBucket = environment.AUTH_USER_REGISTRY_BUCKET?.trim();
  const configuredKey = environment.AUTH_USER_REGISTRY_KEY?.trim();
  if (
    environment.VERCEL_ENV === 'preview' &&
    (!configuredBucket || !configuredKey)
  ) {
    throw new UserStoreConfigurationError(
      'Preview auth registry requires explicit bucket and key configuration'
    );
  }
  const bucket = configuredBucket || 'sorce-dashboard-data';
  const key = configuredKey || 'auth/users.json';
  const region =
    environment.AUTH_USER_REGISTRY_REGION?.trim() ||
    environment.AWS_DEFAULT_REGION?.trim() ||
    'us-east-1';
  return new UserStore(
    createS3RegistryBackend({
      bucket,
      key,
      region
    })
  );
}

export class UserStore {
  constructor(private readonly backend: RegistryObjectBackend) {}

  async load(): Promise<UserRegistrySnapshot> {
    const object = await this.backend.read();
    if (!object.etag) {
      throw new UserStoreError(
        'USER_STORE_UNAVAILABLE',
        'Auth registry object did not provide an ETag'
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(object.body);
    } catch {
      throw new UserStoreError(
        'REGISTRY_INVALID',
        'Auth registry contains invalid JSON'
      );
    }
    return {
      registry: parseUserRegistry(raw),
      etag: object.etag
    };
  }

  /**
   * Load the registry once and apply one mutation with a conditional write
   * against the ETag that was just read; no unconditional write path is
   * exposed. The mutation receives a mutable draft but the result is parsed
   * again, so all schema and cross-record invariants are enforced on writes.
   * A concurrent write is retried a bounded number of times against a fresh
   * snapshot before surfacing as a UserStoreConflictError.
   */
  async update(
    mutation: (draft: UserRegistry) => UserRegistry
  ): Promise<UserRegistrySnapshot> {
    for (let attempt = 0; ; attempt += 1) {
      const current = await this.load();
      const next = parseUserRegistry(
        mutation(structuredClone(current.registry))
      );
      try {
        return await this.writeValidated(next, current.etag);
      } catch (error) {
        if (!(error instanceof UserStoreConflictError) || attempt >= 2) {
          throw error;
        }
      }
    }
  }

  private async writeValidated(
    next: UserRegistry,
    expectedETag: string
  ): Promise<UserRegistrySnapshot> {
    const body = `${JSON.stringify(
      { ...next, updatedAt: new Date().toISOString() },
      null,
      2
    )}\n`;
    const result = await this.backend.write({
      body,
      contentType: 'application/json',
      ifMatch: expectedETag
    });
    return {
      registry: parseUserRegistry(JSON.parse(body)),
      etag: result.etag ?? localETag(body)
    };
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const snapshot = await this.load();
    return snapshot.registry.users.find((user) => user.id === id) ?? null;
  }

  async findUserByName(name: string): Promise<UserRecord | null> {
    const normalized = name.trim().toLowerCase();
    const snapshot = await this.load();
    return (
      snapshot.registry.users.find((user) => user.username === normalized) ??
      null
    );
  }

  async listUsers(): Promise<UserRecord[]> {
    const snapshot = await this.load();
    return snapshot.registry.users;
  }
}

let defaultStore: UserStore | undefined;

/** Lazily construct the process-local store so build-time env is not trusted. */
export function getUserStore(): UserStore {
  if (!defaultStore) defaultStore = createUserStore();
  return defaultStore;
}
