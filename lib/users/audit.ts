import 'server-only';

import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type AuditAction =
  | 'user.created'
  | 'user.enabled'
  | 'user.disabled'
  | 'user.access_changed'
  | 'user.password_reset';

export interface UserAuditEvent {
  actorId: string;
  action: AuditAction;
  targetId: string;
  timestamp: string;
  result: 'success';
  correlationId: string;
}

export interface AuditWriter {
  write(event: UserAuditEvent): Promise<void>;
}

export class AuditWriteError extends Error {
  constructor() {
    super('The audit record could not be written');
    this.name = 'AuditWriteError';
  }
}

interface AuditEnvironment {
  [key: string]: string | undefined;
  AUTH_USER_REGISTRY_BUCKET?: string;
  AUTH_USER_REGISTRY_REGION?: string;
  AWS_DEFAULT_REGION?: string;
}

export interface S3AuditWriterOptions {
  bucket: string;
  region: string;
  client?: S3Client;
}

/**
 * Audit records are separate immutable objects. If-None-Match prevents a
 * retry or a random-key collision from overwriting a prior event. The event
 * type deliberately contains no password, hash, tenant object key, or raw
 * request data.
 */
class S3AuditWriter implements AuditWriter {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    client?: S3Client
  ) {
    this.client = client ?? new S3Client({ region });
  }

  async write(event: UserAuditEvent): Promise<void> {
    const objectKey = `auth/audit/${event.timestamp.replace(/[^0-9TZ.-]/g, '')}-${crypto.randomUUID()}.json`;
    const body = `${JSON.stringify(event)}\n`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: body,
          ContentType: 'application/json',
          IfNoneMatch: '*'
        })
      );
    } catch {
      throw new AuditWriteError();
    }
  }
}

export function createS3AuditWriter(
  options: S3AuditWriterOptions
): AuditWriter {
  return new S3AuditWriter(options.bucket, options.region, options.client);
}

export function getAuditWriter(
  environment: AuditEnvironment = process.env
): AuditWriter {
  const bucket =
    environment.AUTH_USER_REGISTRY_BUCKET?.trim() || 'sorce-dashboard-data';
  const region =
    environment.AUTH_USER_REGISTRY_REGION?.trim() ||
    environment.AWS_DEFAULT_REGION?.trim() ||
    'us-east-1';
  return createS3AuditWriter({ bucket, region });
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
