import { describe, expect, it, vi } from 'vitest';
import {
  createLoginThrottle,
  createS3LoginThrottleBackend,
  LOGIN_THROTTLE_BASE_DELAY_MS,
  LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_MAX_DELAY_MS,
  LOGIN_THROTTLE_WINDOW_MS,
  LoginThrottleConflictError,
  type LoginThrottleObjectBackend,
  type LoginThrottlePutInput,
  loginThrottleObjectKey,
  requestClientIp
} from '@/lib/login-throttle';
import type { S3Client } from '@aws-sdk/client-s3';

class FakeObjectBackend implements LoginThrottleObjectBackend {
  readonly objects = new Map<string, { body: string; etag: string }>();
  failNextWrite = false;
  readCount = 0;
  writeInputs: LoginThrottlePutInput[] = [];
  private sequence = 0;

  read(key: string) {
    this.readCount += 1;
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  write(input: LoginThrottlePutInput) {
    this.writeInputs.push(input);
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return Promise.reject(new LoginThrottleConflictError());
    }
    const current = this.objects.get(input.key);
    if ('ifNoneMatch' in input) {
      if (current) return Promise.reject(new LoginThrottleConflictError());
    } else if (!current || current.etag !== input.ifMatch) {
      return Promise.reject(new LoginThrottleConflictError());
    }
    const etag = `"etag-${++this.sequence}"`;
    this.objects.set(input.key, { body: input.body, etag });
    return Promise.resolve({ etag });
  }
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as { input: Record<string, unknown> }).input;
}

function stateFor(backend: FakeObjectBackend, key: string) {
  const object = backend.objects.get(key);
  expect(object).toBeDefined();
  return JSON.parse(object!.body) as {
    failureCount: number;
    blockedUntil: number;
    windowStartedAt: number;
  };
}

describe('login throttle scope and policy', () => {
  it('uses opaque, stable HMAC account/IP keys', () => {
    const first = loginThrottleObjectKey(
      'test-secret',
      ' Alice ',
      '203.0.113.7'
    );
    const second = loginThrottleObjectKey(
      'test-secret',
      'alice',
      '203.0.113.7'
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^auth\/rate-limit\/[a-f0-9]{64}\.json$/);
    expect(first).not.toContain('alice');
    expect(first).not.toContain('203.0.113.7');
    expect(
      loginThrottleObjectKey('other-secret', 'alice', '203.0.113.7')
    ).not.toBe(first);
  });

  it('uses the proxy-appended forwarded address and has a safe fallback', () => {
    const forwarded = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' }
    });
    expect(requestClientIp(forwarded)).toBe('10.0.0.2');

    const realIp = new Request('https://example.test', {
      headers: { 'x-real-ip': '203.0.113.9' }
    });
    expect(requestClientIp(realIp)).toBe('203.0.113.9');
    expect(requestClientIp(new Request('https://example.test'))).toBe(
      '<unknown-ip>'
    );
  });

  it('applies bounded exponential delays and resets after the window', async () => {
    let now = 1_000;
    const backend = new FakeObjectBackend();
    const throttle = createLoginThrottle({
      backend,
      secret: 'test-secret',
      now: () => now
    });

    expect(await throttle.beforeAttempt('alice', '203.0.113.7')).toBe(true);
    await throttle.recordFailure('alice', '203.0.113.7');
    expect(
      stateFor(
        backend,
        loginThrottleObjectKey('test-secret', 'alice', '203.0.113.7')
      )
    ).toMatchObject({
      failureCount: 1,
      blockedUntil: now + LOGIN_THROTTLE_BASE_DELAY_MS
    });
    expect(await throttle.beforeAttempt('alice', '203.0.113.7')).toBe(false);

    now += LOGIN_THROTTLE_BASE_DELAY_MS;
    expect(await throttle.beforeAttempt('alice', '203.0.113.7')).toBe(true);
    await throttle.recordFailure('alice', '203.0.113.7');
    expect(
      stateFor(
        backend,
        loginThrottleObjectKey('test-secret', 'alice', '203.0.113.7')
      )
    ).toMatchObject({
      failureCount: 2,
      blockedUntil: now + LOGIN_THROTTLE_BASE_DELAY_MS * 2
    });

    for (let index = 2; index < LOGIN_THROTTLE_MAX_FAILURES + 2; index += 1) {
      now += LOGIN_THROTTLE_MAX_DELAY_MS;
      await throttle.recordFailure('alice', '203.0.113.7');
    }
    const capped = stateFor(
      backend,
      loginThrottleObjectKey('test-secret', 'alice', '203.0.113.7')
    );
    expect(capped.failureCount).toBeLessThanOrEqual(
      LOGIN_THROTTLE_MAX_FAILURES
    );
    expect(capped.blockedUntil - now).toBeLessThanOrEqual(
      LOGIN_THROTTLE_MAX_DELAY_MS
    );

    now = capped.windowStartedAt + LOGIN_THROTTLE_WINDOW_MS + 1;
    expect(await throttle.beforeAttempt('alice', '203.0.113.7')).toBe(true);
    await throttle.recordFailure('alice', '203.0.113.7');
    expect(
      stateFor(
        backend,
        loginThrottleObjectKey('test-secret', 'alice', '203.0.113.7')
      ).failureCount
    ).toBe(1);
  });

  it('clears an existing state after a successful login without creating new state', async () => {
    let now = 10_000;
    const backend = new FakeObjectBackend();
    const throttle = createLoginThrottle({
      backend,
      secret: 'test-secret',
      now: () => now
    });

    await throttle.recordSuccess('new-user', '203.0.113.10');
    expect(backend.objects.size).toBe(0);
    await throttle.recordFailure('alice', '203.0.113.10');
    now += LOGIN_THROTTLE_BASE_DELAY_MS;
    await throttle.recordSuccess('alice', '203.0.113.10');
    expect(await throttle.beforeAttempt('alice', '203.0.113.10')).toBe(true);
    expect(
      stateFor(
        backend,
        loginThrottleObjectKey('test-secret', 'alice', '203.0.113.10')
      )
    ).toMatchObject({
      failureCount: 0,
      blockedUntil: 0
    });
  });

  it('retries conditional writes after a concurrent conflict', async () => {
    const backend = new FakeObjectBackend();
    backend.failNextWrite = true;
    const throttle = createLoginThrottle({
      backend,
      secret: 'test-secret',
      now: () => 20_000
    });

    await throttle.recordFailure('alice', '203.0.113.11');
    expect(backend.writeInputs).toHaveLength(2);
    expect('ifNoneMatch' in backend.writeInputs[0]).toBe(true);
    expect('ifNoneMatch' in backend.writeInputs[1]).toBe(true);
  });

  it('fails closed on malformed persisted state', async () => {
    const backend = new FakeObjectBackend();
    const key = loginThrottleObjectKey('test-secret', 'alice', '203.0.113.11');
    backend.objects.set(key, {
      body: JSON.stringify({
        schemaVersion: 1,
        windowStartedAt: 0,
        failureCount: LOGIN_THROTTLE_MAX_FAILURES + 1,
        blockedUntil: 0
      }),
      etag: '"bad"'
    });
    const throttle = createLoginThrottle({
      backend,
      secret: 'test-secret',
      now: () => 20_000
    });

    await expect(throttle.beforeAttempt('alice', '203.0.113.11')).resolves.toBe(
      false
    );
    // The unreadable object is replaced with a fresh single-failure state so
    // the pair is not locked out until the lifecycle rule deletes it.
    expect(stateFor(backend, key)).toMatchObject({
      failureCount: 1,
      blockedUntil: 20_000 + LOGIN_THROTTLE_BASE_DELAY_MS
    });
  });

  it('locks a pair out for the maximum delay once the failure limit is reached', async () => {
    let now = 30_000;
    const backend = new FakeObjectBackend();
    const key = loginThrottleObjectKey('test-secret', 'alice', '203.0.113.13');
    const throttle = createLoginThrottle({
      backend,
      secret: 'test-secret',
      now: () => now
    });

    for (let index = 1; index <= LOGIN_THROTTLE_MAX_FAILURES; index += 1) {
      expect(await throttle.beforeAttempt('alice', '203.0.113.13')).toBe(true);
      await throttle.recordFailure('alice', '203.0.113.13');
      const state = stateFor(backend, key);
      expect(state.failureCount).toBe(index);
      if (index < LOGIN_THROTTLE_MAX_FAILURES) now = state.blockedUntil;
    }
    const lockedOut = stateFor(backend, key);
    expect(lockedOut).toMatchObject({
      failureCount: LOGIN_THROTTLE_MAX_FAILURES,
      blockedUntil: now + LOGIN_THROTTLE_MAX_DELAY_MS
    });

    // The window does not reset underneath an active lockout, even once the
    // original 15-minute window has elapsed.
    now += LOGIN_THROTTLE_WINDOW_MS - 1;
    expect(await throttle.beforeAttempt('alice', '203.0.113.13')).toBe(false);
    await throttle.recordFailure('alice', '203.0.113.13');
    expect(stateFor(backend, key)).toMatchObject({
      failureCount: LOGIN_THROTTLE_MAX_FAILURES,
      windowStartedAt: lockedOut.windowStartedAt
    });
  });

  it('is a deterministic no-op in development/test and fails closed without a secret in production', async () => {
    const development = createLoginThrottle({
      environment: { NODE_ENV: 'development' }
    });
    expect(await development.beforeAttempt('alice', '203.0.113.12')).toBe(true);

    const production = createLoginThrottle({
      environment: { NODE_ENV: 'production' }
    });
    expect(await production.beforeAttempt('alice', '203.0.113.12')).toBe(false);
  });

  it('fails closed for a preview without an explicit rate-limit bucket and prefix', async () => {
    const preview = createLoginThrottle({
      environment: {
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        AUTH_SECRET: 'preview-secret',
        AUTH_USER_REGISTRY_BUCKET: 'preview-registry',
        AUTH_USER_REGISTRY_KEY: 'preview/auth/users.json'
      }
    });
    expect(await preview.beforeAttempt('alice', '203.0.113.13')).toBe(false);
  });
});

describe('S3 login throttle backend', () => {
  it('uses typed conditional create and update writes', async () => {
    const send = vi.fn().mockResolvedValue({ ETag: '"next"' });
    const backend = createS3LoginThrottleBackend({
      bucket: 'sorce-dashboard-data',
      region: 'us-east-1',
      client: { send } as unknown as S3Client
    });

    await backend.write({
      key: 'auth/rate-limit/abc.json',
      body: '{}',
      ifNoneMatch: '*'
    });
    await backend.write({
      key: 'auth/rate-limit/abc.json',
      body: '{}',
      ifMatch: '"current"'
    });

    expect(inputOf(send.mock.calls[0]?.[0])).toMatchObject({
      Bucket: 'sorce-dashboard-data',
      Key: 'auth/rate-limit/abc.json',
      IfNoneMatch: '*'
    });
    expect(inputOf(send.mock.calls[1]?.[0])).toMatchObject({
      Bucket: 'sorce-dashboard-data',
      Key: 'auth/rate-limit/abc.json',
      IfMatch: '"current"'
    });
  });

  it('maps missing objects to null and conditional conflicts to a safe error', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } });
    const backend = createS3LoginThrottleBackend({
      bucket: 'sorce-dashboard-data',
      region: 'us-east-1',
      client: { send } as unknown as S3Client
    });

    await expect(
      backend.read('auth/rate-limit/missing.json')
    ).resolves.toBeNull();
    await expect(
      backend.write({
        key: 'auth/rate-limit/abc.json',
        body: '{}',
        ifNoneMatch: '*'
      })
    ).rejects.toBeInstanceOf(LoginThrottleConflictError);
  });
});
