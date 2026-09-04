import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { parseDashboardData, parseTeamStats } from './dashboard-data-contract';
import type { CompanyStats, SorceData } from './sorce_data';
import { resolvePrincipalTenant, type Principal } from './users';

type DataFailureStatus =
  | 'notConfigured'
  | 'notGenerated'
  | 'temporarilyUnavailable'
  | 'invalidPayload'
  | 'forbidden';

export type DataResult<T> =
  | { status: 'ok'; data: T }
  | { status: DataFailureStatus };

interface ObjectReadSuccess {
  status: 'ok';
  body: string;
}

type ObjectReadResult =
  | ObjectReadSuccess
  | { status: 'notConfigured' | 'notGenerated' | 'temporarilyUnavailable' };

interface DashboardDataEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  SORCE_DATA_SOURCE?: string;
  SORCE_DATA_LOCAL_ROOT?: string;
  SORCE_DATA_BUCKET?: string;
  SORCE_DATA_REGION?: string;
  SORCE_DATA_CACHE_SECONDS?: string;
  AWS_DEFAULT_REGION?: string;
}

type ObjectReader = (key: string) => Promise<ObjectReadResult>;

interface AuthorizedTenant {
  principal: Principal;
  tenant: {
    id: string;
    dashboardObjectKey: string;
    enabled: boolean;
  };
}

type PrincipalResolver = (
  principal: Principal
) => Promise<AuthorizedTenant | null>;

interface DashboardDataServiceOptions {
  readObject: ObjectReader;
  resolvePrincipal: PrincipalResolver;
  teamStatsKey: string;
  cacheTtlMs?: number;
  now?: () => number;
}

/**
 * Authorize before reading or parsing data. Routes never accept an object key,
 * tenant ID, or role from browser-controlled input.
 */
export function createDashboardDataService({
  readObject,
  resolvePrincipal,
  teamStatsKey,
  cacheTtlMs = 0,
  now = Date.now
}: DashboardDataServiceOptions) {
  const cache = new Map<
    string,
    { expiresAt: number; value: DataResult<SorceData | CompanyStats[]> }
  >();

  function readCache<T>(key: string): DataResult<T> | null {
    if (cacheTtlMs <= 0) return null;
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      cache.delete(key);
      return null;
    }
    return entry.value as DataResult<T>;
  }

  function writeCache<T>(key: string, value: DataResult<T>): void {
    if (cacheTtlMs <= 0 || value.status !== 'ok') return;
    cache.set(key, {
      expiresAt: now() + cacheTtlMs,
      value: value as DataResult<SorceData | CompanyStats[]>
    });
  }

  return {
    async dashboard(principal: Principal): Promise<DataResult<SorceData>> {
      const access = await resolvePrincipal(principal);
      if (!access) return { status: 'forbidden' };
      if (!access.tenant.enabled || !access.tenant.dashboardObjectKey) {
        return { status: 'notConfigured' };
      }

      // Authorization is deliberately resolved before this lookup. Tenant ID
      // and the explicit object key prevent data crossing cache boundaries.
      const cacheKey = `dashboard:${access.tenant.id}:${access.tenant.dashboardObjectKey}`;
      const cached = readCache<SorceData>(cacheKey);
      if (cached) return cached;

      const object = await readObject(access.tenant.dashboardObjectKey);
      if (object.status !== 'ok') return object;

      try {
        const result: DataResult<SorceData> = {
          status: 'ok',
          data: parseDashboardData(JSON.parse(object.body))
        };
        writeCache(cacheKey, result);
        return result;
      } catch {
        return { status: 'invalidPayload' };
      }
    },

    async teamStats(principal: Principal): Promise<DataResult<CompanyStats[]>> {
      const access = await resolvePrincipal(principal);
      if (!access || access.principal.role !== 'admin') {
        return { status: 'forbidden' };
      }

      const cacheKey = `team-stats:${access.tenant.id}:${teamStatsKey}`;
      const cached = readCache<CompanyStats[]>(cacheKey);
      if (cached) return cached;

      const object = await readObject(teamStatsKey);
      if (object.status !== 'ok') return object;

      try {
        const result: DataResult<CompanyStats[]> = {
          status: 'ok',
          data: parseTeamStats(JSON.parse(object.body))
        };
        writeCache(cacheKey, result);
        return result;
      } catch {
        return { status: 'invalidPayload' };
      }
    }
  };
}

function configuredCacheTtlMs(
  environment: DashboardDataEnvironment
): number | null {
  const raw = environment.SORCE_DATA_CACHE_SECONDS?.trim();
  if (!raw) return 60_000;
  if (!/^\d+$/.test(raw)) return null;
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 900) {
    return null;
  }
  return seconds * 1_000;
}

function isLocalAllowed(environment: DashboardDataEnvironment): boolean {
  return (
    environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test'
  );
}

function configuredSource(
  environment: DashboardDataEnvironment
): 'local' | 's3' | null {
  const requested = environment.SORCE_DATA_SOURCE?.trim().toLowerCase();
  if (requested === 'local') {
    return isLocalAllowed(environment) ? 'local' : null;
  }
  if (requested === 's3') return 's3';
  if (requested) return null;

  // Local development is fixture-only. Vercel previews must explicitly opt
  // into a staging source and can never silently fall through to production.
  if (isLocalAllowed(environment)) return 'local';
  if (environment.VERCEL_ENV === 'preview') return null;
  return 's3';
}

function isSafeRelativeKey(key: string): boolean {
  return (
    key.length > 0 &&
    !path.isAbsolute(key) &&
    !key.includes('\\') &&
    !key.split('/').some((part) => part === '..')
  );
}

function createObjectReader(
  environment: DashboardDataEnvironment = process.env
): ObjectReader {
  const source = configuredSource(environment);
  if (!source) {
    return () => Promise.resolve({ status: 'notConfigured' });
  }

  if (source === 'local') {
    const configuredRoot = environment.SORCE_DATA_LOCAL_ROOT?.trim();
    const root = configuredRoot
      ? path.resolve(configuredRoot)
      : path.join(process.cwd(), 'tests', 'fixtures', 'dashboard');

    return async (key) => {
      if (!isSafeRelativeKey(key)) return { status: 'notConfigured' };
      try {
        const body = await fs.readFile(path.join(root, key), 'utf8');
        return { status: 'ok', body };
      } catch (error) {
        if (isMissingObject(error)) return { status: 'notGenerated' };
        return { status: 'temporarilyUnavailable' };
      }
    };
  }

  if (
    environment.VERCEL_ENV === 'preview' &&
    !environment.SORCE_DATA_BUCKET?.trim()
  ) {
    return () => Promise.resolve({ status: 'notConfigured' });
  }

  const bucket =
    environment.SORCE_DATA_BUCKET?.trim() || 'sorce-dashboard-data';
  const region =
    environment.SORCE_DATA_REGION?.trim() ||
    environment.AWS_DEFAULT_REGION?.trim() ||
    'us-east-1';
  const client = new S3Client({ region, maxAttempts: 2 });

  return async (key) => {
    if (!isSafeRelativeKey(key)) return { status: 'notConfigured' };
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(8_000) }
      );
      if (!response.Body) return { status: 'temporarilyUnavailable' };
      return { status: 'ok', body: await response.Body.transformToString() };
    } catch (error) {
      if (isMissingObject(error)) return { status: 'notGenerated' };
      return { status: 'temporarilyUnavailable' };
    }
  };
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && (error as { code?: unknown }).code === 'ENOENT') {
    return true;
  }
  if ('name' in error) {
    const name = (error as { name?: unknown }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') return true;
  }
  if ('$metadata' in error) {
    return (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    );
  }
  return false;
}

let defaultService: ReturnType<typeof createDashboardDataService> | undefined;

function getDefaultService() {
  const cacheTtlMs = configuredCacheTtlMs(process.env);
  defaultService ??= createDashboardDataService({
    readObject:
      cacheTtlMs === null
        ? () => Promise.resolve({ status: 'notConfigured' })
        : createObjectReader(),
    resolvePrincipal: resolvePrincipalTenant,
    teamStatsKey:
      process.env.SORCE_TEAM_STATS_KEY?.trim() || 'companies/team_stats.json',
    cacheTtlMs: cacheTtlMs ?? 0
  });
  return defaultService;
}

export async function retrieveDashboardData(
  principal: Principal
): Promise<DataResult<SorceData>> {
  return getDefaultService().dashboard(principal);
}

export async function retrieveTeamStats(
  principal: Principal
): Promise<DataResult<CompanyStats[]>> {
  return getDefaultService().teamStats(principal);
}

export function isDashboardDataStale(
  data: SorceData,
  now = Date.now(),
  staleAfterHours = 48
): boolean {
  const sourceTimestamp = data.generatedAt ?? data.charts[0]?.today[0]?.date;
  if (!sourceTimestamp) return false;
  const sourceTime = Date.parse(sourceTimestamp);
  return (
    Number.isFinite(sourceTime) &&
    now - sourceTime > staleAfterHours * 60 * 60 * 1_000
  );
}
