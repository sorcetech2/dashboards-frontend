import 'server-only';

import crypto from 'node:crypto';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { normalizeUsername } from './users/schema';

export const LOGIN_THROTTLE_PREFIX = 'auth/rate-limit/';
export const LOGIN_THROTTLE_SCHEMA_VERSION = 1;

// These limits are intentionally finite. A bad actor can be slowed down, but
// a stale object can never impose an unbounded delay or grow without limit.
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_BASE_DELAY_MS = 500;
export const LOGIN_THROTTLE_MAX_DELAY_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_MAX_FAILURES = 8;
const LOGIN_THROTTLE_WRITE_RETRIES = 4;

export interface LoginThrottleState {
  schemaVersion: typeof LOGIN_THROTTLE_SCHEMA_VERSION;
  windowStartedAt: number;
  failureCount: number;
  blockedUntil: number;
}

export type LoginThrottlePutInput =
  | {
      key: string;
      body: string;
      ifMatch: string;
      ifNoneMatch?: never;
    }
  | {
      key: string;
      body: string;
      ifMatch?: never;
      ifNoneMatch: '*';
    };

export interface LoginThrottleObjectBackend {
  read(key: string): Promise<{ body: string; etag: string } | null>;
  write(input: LoginThrottlePutInput): Promise<{ etag?: string }>;
}

export interface LoginThrottleEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  AUTH_LOGIN_THROTTLE_SECRET?: string;
  AUTH_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  AUTH_USER_REGISTRY_BUCKET?: string;
  AUTH_USER_REGISTRY_KEY?: string;
  AUTH_USER_REGISTRY_REGION?: string;
  AUTH_LOGIN_THROTTLE_BUCKET?: string;
  AUTH_LOGIN_THROTTLE_KEY_PREFIX?: string;
  AUTH_LOGIN_THROTTLE_REGION?: string;
  AWS_DEFAULT_REGION?: string;
}

export interface LoginThrottleOptions {
  backend?: LoginThrottleObjectBackend;
  secret?: string;
  keyPrefix?: string;
  now?: () => number;
}

export interface LoginThrottle {
  beforeAttempt(account: unknown, ip: unknown): Promise<boolean>;
  recordFailure(account: unknown, ip: unknown): Promise<void>;
  recordSuccess(account: unknown, ip: unknown): Promise<void>;
}

export class LoginThrottleError extends Error {
  readonly code: string;

  constructor(code: string, message = 'Login throttle unavailable') {
    super(message);
    this.name = 'LoginThrottleError';
    this.code = code;
  }
}

export class LoginThrottleConflictError extends LoginThrottleError {
  constructor() {
    super('LOGIN_THROTTLE_CONFLICT');
    this.name = 'LoginThrottleConflictError';
  }
}

function normalizeScopePart(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 256) return fallback;
  return normalized;
}

/**
 * Build the opaque S3 object key for one account/IP pair. Neither component
 * is present in the key; the digest is keyed so it cannot be used as a
 * username or IP dictionary without the deployment secret.
 */
export function loginThrottleObjectKey(
  secret: string,
  account: unknown,
  ip: unknown,
  keyPrefix = LOGIN_THROTTLE_PREFIX
): string {
  const normalizedAccount = normalizeScopePart(
    typeof account === 'string' ? normalizeUsername(account) : account,
    '<invalid-account>'
  );
  const normalizedIp = normalizeScopePart(ip, '<unknown-ip>');
  const digest = crypto
    .createHmac('sha256', secret)
    .update(normalizedAccount)
    .update('\u0000')
    .update(normalizedIp)
    .digest('hex');
  return `${keyPrefix}${digest}.json`;
}

/**
 * Extract only a bounded client address from the proxy headers. The rightmost
 * X-Forwarded-For entry was appended by the nearest trusted proxy; the leftmost
 * is whatever the client sent and must not be able to partition the throttle.
 */
export function requestClientIp(request: Pick<Request, 'headers'>): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const lastForwarded = forwarded?.split(',').at(-1)?.trim();
  if (lastForwarded && lastForwarded.length <= 256) return lastForwarded;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && realIp.length <= 256) return realIp;
  return '<unknown-ip>';
}

function parseState(body: string): LoginThrottleState {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new LoginThrottleError('LOGIN_THROTTLE_INVALID');
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== LOGIN_THROTTLE_SCHEMA_VERSION ||
    !('windowStartedAt' in value) ||
    !('failureCount' in value) ||
    !('blockedUntil' in value) ||
    typeof value.windowStartedAt !== 'number' ||
    !Number.isSafeInteger(value.windowStartedAt) ||
    typeof value.failureCount !== 'number' ||
    !Number.isSafeInteger(value.failureCount) ||
    value.failureCount < 0 ||
    value.failureCount > LOGIN_THROTTLE_MAX_FAILURES ||
    typeof value.blockedUntil !== 'number' ||
    !Number.isSafeInteger(value.blockedUntil) ||
    value.windowStartedAt < 0 ||
    value.blockedUntil < 0
  ) {
    throw new LoginThrottleError('LOGIN_THROTTLE_INVALID');
  }

  return {
    schemaVersion: LOGIN_THROTTLE_SCHEMA_VERSION,
    windowStartedAt: value.windowStartedAt,
    failureCount: value.failureCount,
    blockedUntil: value.blockedUntil
  };
}

function tryParseState(body: string): LoginThrottleState | undefined {
  try {
    return parseState(body);
  } catch {
    return undefined;
  }
}

function nextFailureState(now: number, current?: LoginThrottleState) {
  // A pair stays in its window while it is blocked, so an active lockout is
  // never shortened by the window expiring underneath it.
  const inWindow = Boolean(
    current &&
      (now - current.windowStartedAt < LOGIN_THROTTLE_WINDOW_MS ||
        now < current.blockedUntil)
  );
  const failureCount = inWindow
    ? Math.min(current!.failureCount + 1, LOGIN_THROTTLE_MAX_FAILURES)
    : 1;
  const windowStartedAt = inWindow ? current!.windowStartedAt : now;
  // Below the failure limit the delay escalates exponentially; reaching the
  // limit locks the pair out for the full maximum delay.
  const delay =
    failureCount >= LOGIN_THROTTLE_MAX_FAILURES
      ? LOGIN_THROTTLE_MAX_DELAY_MS
      : Math.min(
          LOGIN_THROTTLE_BASE_DELAY_MS * 2 ** (failureCount - 1),
          LOGIN_THROTTLE_MAX_DELAY_MS
        );
  return {
    schemaVersion: LOGIN_THROTTLE_SCHEMA_VERSION,
    windowStartedAt,
    failureCount,
    blockedUntil: now + delay
  } satisfies LoginThrottleState;
}

function clearedState(now: number): LoginThrottleState {
  return {
    schemaVersion: LOGIN_THROTTLE_SCHEMA_VERSION,
    windowStartedAt: now,
    failureCount: 0,
    blockedUntil: 0
  };
}

function stateBody(state: LoginThrottleState): string {
  return `${JSON.stringify(state)}\n`;
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('$metadata' in error) {
    const code = (error as { $metadata?: { httpStatusCode?: unknown } })
      .$metadata?.httpStatusCode;
    if (typeof code === 'number') return code;
  }
  if ('statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

function isNotFound(error: unknown): boolean {
  // Without s3:ListBucket (which the documented IAM grant deliberately omits)
  // S3 answers GetObject on a missing key with 403 rather than 404. Treating
  // it as "no state yet" is safe: a genuinely denied role still fails closed
  // because the conditional PutObject that follows is rejected.
  const status = statusCode(error);
  if (status === 404 || status === 403) return true;
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === 'NoSuchKey' || name === 'NotFound';
}

class S3LoginThrottleBackend implements LoginThrottleObjectBackend {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    client?: S3Client
  ) {
    this.client = client ?? new S3Client({ region });
  }

  async read(key: string): Promise<{ body: string; etag: string } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!response.Body || !response.ETag) {
        throw new LoginThrottleError('LOGIN_THROTTLE_UNAVAILABLE');
      }
      return {
        body: await response.Body.transformToString(),
        etag: response.ETag
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      if (error instanceof LoginThrottleError) throw error;
      throw new LoginThrottleError('LOGIN_THROTTLE_UNAVAILABLE');
    }
  }

  async write(input: LoginThrottlePutInput): Promise<{ etag?: string }> {
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: 'application/json',
          ...('ifMatch' in input
            ? { IfMatch: input.ifMatch }
            : { IfNoneMatch: input.ifNoneMatch })
        })
      );
      return { etag: response.ETag };
    } catch (error) {
      if (statusCode(error) === 409 || statusCode(error) === 412) {
        throw new LoginThrottleConflictError();
      }
      throw new LoginThrottleError('LOGIN_THROTTLE_WRITE_FAILED');
    }
  }
}

export interface S3LoginThrottleBackendConfig {
  bucket: string;
  region: string;
  client?: S3Client;
}

export function createS3LoginThrottleBackend(
  config: S3LoginThrottleBackendConfig
): LoginThrottleObjectBackend {
  return new S3LoginThrottleBackend(
    config.bucket,
    config.region,
    config.client
  );
}

class NoopLoginThrottle implements LoginThrottle {
  beforeAttempt(): Promise<boolean> {
    return Promise.resolve(true);
  }

  recordFailure(): Promise<void> {
    return Promise.resolve();
  }

  recordSuccess(): Promise<void> {
    return Promise.resolve();
  }
}

class FailClosedLoginThrottle implements LoginThrottle {
  beforeAttempt(): Promise<boolean> {
    return Promise.resolve(false);
  }

  recordFailure(): Promise<void> {
    return Promise.resolve();
  }

  recordSuccess(): Promise<void> {
    return Promise.resolve();
  }
}

class DurableLoginThrottle implements LoginThrottle {
  constructor(
    private readonly backend: LoginThrottleObjectBackend,
    private readonly secret: string,
    private readonly keyPrefix: string,
    private readonly now: () => number
  ) {}

  private key(account: unknown, ip: unknown): string {
    return loginThrottleObjectKey(this.secret, account, ip, this.keyPrefix);
  }

  async beforeAttempt(account: unknown, ip: unknown): Promise<boolean> {
    let object: { body: string; etag: string } | null;
    try {
      object = await this.backend.read(this.key(account, ip));
    } catch {
      // A throttle read failure must never turn into an authentication
      // allow. The caller receives only the generic false decision.
      return false;
    }
    if (!object) return true;

    const state = tryParseState(object.body);
    if (!state) {
      // An unreadable object (corruption, schema bump) must not lock the pair
      // out until the lifecycle rule deletes it. Replace it with a fresh
      // single-failure state, deny this attempt, and let the next one proceed.
      try {
        await this.mutate(account, ip, (_current, now) =>
          nextFailureState(now, undefined)
        );
      } catch {
        // Still fail closed; the next attempt retries the repair.
      }
      return false;
    }
    return state.blockedUntil <= this.now();
  }

  async recordFailure(account: unknown, ip: unknown): Promise<void> {
    await this.mutate(account, ip, (current, now) =>
      nextFailureState(now, current)
    );
  }

  async recordSuccess(account: unknown, ip: unknown): Promise<void> {
    await this.mutate(account, ip, (_current, now) => clearedState(now), false);
  }

  private async mutate(
    account: unknown,
    ip: unknown,
    transition: (
      current: LoginThrottleState | undefined,
      now: number
    ) => LoginThrottleState,
    createIfMissing = true
  ): Promise<void> {
    const key = this.key(account, ip);
    for (
      let attempt = 0;
      attempt < LOGIN_THROTTLE_WRITE_RETRIES;
      attempt += 1
    ) {
      const object = await this.backend.read(key);
      if (!object && !createIfMissing) return;
      // An unparseable object is treated as no state so the conditional write
      // below overwrites it instead of leaving it in place forever.
      const current = object ? tryParseState(object.body) : undefined;
      const next = transition(current, this.now());
      try {
        if (object) {
          await this.backend.write({
            key,
            body: stateBody(next),
            ifMatch: object.etag
          });
        } else {
          await this.backend.write({
            key,
            body: stateBody(next),
            ifNoneMatch: '*'
          });
        }
        return;
      } catch (error) {
        if (!(error instanceof LoginThrottleConflictError)) throw error;
      }
    }
    throw new LoginThrottleConflictError();
  }
}

function isDevelopmentOrTest(environment: LoginThrottleEnvironment): boolean {
  return (
    environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test'
  );
}

function configuredSecret(environment: LoginThrottleEnvironment): string {
  return (
    environment.AUTH_LOGIN_THROTTLE_SECRET?.trim() ||
    environment.AUTH_SECRET?.trim() ||
    environment.NEXTAUTH_SECRET?.trim() ||
    ''
  );
}

function configuredKeyPrefix(environment: LoginThrottleEnvironment): string {
  const configured = environment.AUTH_LOGIN_THROTTLE_KEY_PREFIX?.trim();
  if (!configured) return LOGIN_THROTTLE_PREFIX;
  return validKeyPrefix(configured);
}

function validKeyPrefix(configured: string): string {
  if (
    configured.length > 512 ||
    configured.startsWith('/') ||
    configured.includes('\\') ||
    configured.split('/').some((part) => part === '..') ||
    !configured.endsWith('/')
  ) {
    return '';
  }
  return configured;
}

export function createLoginThrottle(
  options: LoginThrottleOptions & {
    environment?: LoginThrottleEnvironment;
  } = {}
): LoginThrottle {
  const environment = options.environment ?? process.env;
  if (options.backend) {
    const secret = options.secret?.trim() || configuredSecret(environment);
    const keyPrefix =
      options.keyPrefix === undefined
        ? configuredKeyPrefix(environment)
        : validKeyPrefix(options.keyPrefix.trim());
    if (!secret || !keyPrefix) return new FailClosedLoginThrottle();
    return new DurableLoginThrottle(
      options.backend,
      secret,
      keyPrefix,
      options.now ?? Date.now
    );
  }
  if (isDevelopmentOrTest(environment)) return new NoopLoginThrottle();

  const secret = configuredSecret(environment);
  const configuredBucket = environment.AUTH_LOGIN_THROTTLE_BUCKET?.trim();
  const configuredPrefix = environment.AUTH_LOGIN_THROTTLE_KEY_PREFIX?.trim();
  if (
    !secret ||
    (environment.VERCEL_ENV === 'preview' &&
      (!configuredBucket || !configuredPrefix))
  ) {
    return new FailClosedLoginThrottle();
  }
  const keyPrefix = configuredKeyPrefix(environment);
  if (!keyPrefix) return new FailClosedLoginThrottle();
  const bucket =
    configuredBucket ||
    environment.AUTH_USER_REGISTRY_BUCKET?.trim() ||
    'sorce-dashboard-data';
  const region =
    environment.AUTH_LOGIN_THROTTLE_REGION?.trim() ||
    environment.AUTH_USER_REGISTRY_REGION?.trim() ||
    environment.AWS_DEFAULT_REGION?.trim() ||
    'us-east-1';
  return new DurableLoginThrottle(
    createS3LoginThrottleBackend({ bucket, region }),
    secret,
    keyPrefix,
    options.now ?? Date.now
  );
}

let defaultLoginThrottle: LoginThrottle | undefined;

/** Lazily construct the production S3 throttle; no production counters live in memory. */
export function getLoginThrottle(): LoginThrottle {
  if (!defaultLoginThrottle) defaultLoginThrottle = createLoginThrottle();
  return defaultLoginThrottle;
}
