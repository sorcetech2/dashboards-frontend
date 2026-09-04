import { describe, expect, it, vi } from 'vitest';
import {
  createS3RegistryBackend,
  createUserStore,
  UserStoreConfigurationError,
  UserStoreConflictError
} from '@/lib/users/store';
import type { PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';

function inputOf(command: unknown): {
  Bucket?: string;
  Key?: string;
  Body?: unknown;
  ContentType?: string;
  IfMatch?: string;
} {
  return (command as { input: PutObjectCommandInput }).input;
}

describe('S3 user registry backend', () => {
  it('serializes a typed PutObject If-Match request', async () => {
    const send = vi.fn().mockResolvedValue({ ETag: '"next-etag"' });
    const backend = createS3RegistryBackend({
      bucket: 'sorce-dashboard-data',
      key: 'auth/users.json',
      region: 'us-east-1',
      client: { send } as unknown as S3Client
    });

    const result = await backend.write({
      body: '{"schemaVersion":1}',
      contentType: 'application/json',
      ifMatch: '"current-etag"'
    });

    expect(result).toEqual({ etag: '"next-etag"' });
    expect(send).toHaveBeenCalledOnce();
    expect(inputOf(send.mock.calls[0]?.[0])).toMatchObject({
      Bucket: 'sorce-dashboard-data',
      Key: 'auth/users.json',
      Body: '{"schemaVersion":1}',
      ContentType: 'application/json',
      IfMatch: '"current-etag"'
    });
  });

  it.each([409, 412])(
    'maps S3 HTTP %s to a safe registry conflict',
    async (status) => {
      const send = vi.fn().mockRejectedValue({
        $metadata: { httpStatusCode: status }
      });
      const backend = createS3RegistryBackend({
        bucket: 'sorce-dashboard-data',
        key: 'auth/users.json',
        region: 'us-east-1',
        client: { send } as unknown as S3Client
      });

      await expect(
        backend.write({
          body: '{}',
          contentType: 'application/json',
          ifMatch: '"stale-etag"'
        })
      ).rejects.toBeInstanceOf(UserStoreConflictError);
    }
  );
});

describe('preview registry configuration', () => {
  it('does not inherit production bucket/key defaults', () => {
    expect(() =>
      createUserStore({
        environment: { NODE_ENV: 'production', VERCEL_ENV: 'preview' }
      })
    ).toThrow(UserStoreConfigurationError);
  });

  it('allows an explicitly isolated preview bucket and key', () => {
    expect(() =>
      createUserStore({
        environment: {
          NODE_ENV: 'production',
          VERCEL_ENV: 'preview',
          AUTH_USER_REGISTRY_BUCKET: 'preview-bucket',
          AUTH_USER_REGISTRY_KEY: 'preview/auth/users.json'
        }
      })
    ).not.toThrow();
  });
});
