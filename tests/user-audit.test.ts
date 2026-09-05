import { describe, expect, it, vi } from 'vitest';
import type { PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { createS3AuditWriter } from '@/lib/users/audit';

describe('S3 user audit writer', () => {
  it('writes immutable redacted records under the auth audit prefix', async () => {
    const send = vi.fn().mockResolvedValue({});
    const writer = createS3AuditWriter({
      bucket: 'sorce-dashboard-data',
      region: 'us-east-1',
      client: { send } as unknown as S3Client
    });

    await writer.write({
      actorId: 'admin-1',
      action: 'user.password_reset',
      targetId: 'user-1',
      timestamp: '2026-09-04T10:00:00.000Z',
      result: 'success',
      correlationId: 'request-1'
    });

    const input = (send.mock.calls[0]?.[0] as { input: PutObjectCommandInput })
      .input;
    expect(input).toMatchObject({
      Bucket: 'sorce-dashboard-data',
      ContentType: 'application/json',
      IfNoneMatch: '*'
    });
    expect(input.Key).toMatch(/^auth\/audit\/2026-09-04T100000\.000Z-/);
    expect(input.Body).toBe(
      '{"actorId":"admin-1","action":"user.password_reset","targetId":"user-1","timestamp":"2026-09-04T10:00:00.000Z","result":"success","correlationId":"request-1"}\n'
    );
  });
});
