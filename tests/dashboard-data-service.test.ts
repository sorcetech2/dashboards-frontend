import populatedDashboard from './fixtures/dashboard/populated-dashboard.json';
import populatedTeamStats from './fixtures/dashboard/populated-team-stats.json';
import { describe, expect, it, vi } from 'vitest';
import { parseDashboardData } from '@/lib/dashboard-data-contract';
import { createDashboardDataService, isDashboardDataStale } from '@/lib/data';
import type { Principal } from '@/lib/users';

const viewer: Principal = {
  id: 'user_viewer',
  username: 'viewer',
  displayName: 'Viewer',
  role: 'viewer',
  tenantId: 'tenant_example',
  enabled: true,
  authVersion: 1
};

const admin: Principal = { ...viewer, id: 'user_admin', role: 'admin' };

function resolver(principal: Principal) {
  return Promise.resolve({
    principal,
    tenant: {
      id: principal.tenantId,
      dashboardObjectKey: 'companies/example.json',
      enabled: true
    }
  });
}

describe('authorized dashboard data service', () => {
  it('loads and validates the principal tenant dashboard', async () => {
    const readObject = vi.fn().mockResolvedValue({
      status: 'ok',
      body: JSON.stringify(populatedDashboard)
    });
    const service = createDashboardDataService({
      readObject,
      resolvePrincipal: resolver,
      teamStatsKey: 'companies/team_stats.json'
    });

    const result = await service.dashboard(viewer);

    expect(result.status).toBe('ok');
    expect(readObject).toHaveBeenCalledWith('companies/example.json');
  });

  it('authorizes before attempting an object read', async () => {
    const readObject = vi.fn();
    const service = createDashboardDataService({
      readObject,
      resolvePrincipal: () => Promise.resolve(null),
      teamStatsKey: 'companies/team_stats.json'
    });

    await expect(service.dashboard(viewer)).resolves.toEqual({
      status: 'forbidden'
    });
    expect(readObject).not.toHaveBeenCalled();
  });

  it('does not let a viewer read cross-company team stats', async () => {
    const readObject = vi.fn();
    const service = createDashboardDataService({
      readObject,
      resolvePrincipal: resolver,
      teamStatsKey: 'companies/team_stats.json'
    });

    await expect(service.teamStats(viewer)).resolves.toEqual({
      status: 'forbidden'
    });
    expect(readObject).not.toHaveBeenCalled();
  });

  it('loads team stats for an authoritative admin', async () => {
    const readObject = vi.fn().mockResolvedValue({
      status: 'ok',
      body: JSON.stringify(populatedTeamStats)
    });
    const service = createDashboardDataService({
      readObject,
      resolvePrincipal: resolver,
      teamStatsKey: 'companies/team_stats.json'
    });

    const result = await service.teamStats(admin);

    expect(result.status).toBe('ok');
    expect(readObject).toHaveBeenCalledWith('companies/team_stats.json');
  });

  it('distinguishes invalid payloads from missing objects', async () => {
    const invalidService = createDashboardDataService({
      readObject: () => Promise.resolve({ status: 'ok', body: '{"charts":' }),
      resolvePrincipal: resolver,
      teamStatsKey: 'companies/team_stats.json'
    });
    const missingService = createDashboardDataService({
      readObject: () => Promise.resolve({ status: 'notGenerated' }),
      resolvePrincipal: resolver,
      teamStatsKey: 'companies/team_stats.json'
    });

    await expect(invalidService.dashboard(viewer)).resolves.toEqual({
      status: 'invalidPayload'
    });
    await expect(missingService.dashboard(viewer)).resolves.toEqual({
      status: 'notGenerated'
    });
  });

  it('caches only after authorization and keeps tenant IDs in the boundary', async () => {
    let now = 1_000;
    const readObject = vi.fn().mockResolvedValue({
      status: 'ok',
      body: JSON.stringify(populatedDashboard)
    });
    const resolvePrincipal = vi.fn(resolver);
    const service = createDashboardDataService({
      readObject,
      resolvePrincipal,
      teamStatsKey: 'companies/team_stats.json',
      cacheTtlMs: 5_000,
      now: () => now
    });

    await service.dashboard(viewer);
    await service.dashboard(viewer);
    expect(resolvePrincipal).toHaveBeenCalledTimes(2);
    expect(readObject).toHaveBeenCalledTimes(1);

    now += 5_001;
    await service.dashboard(viewer);
    expect(resolvePrincipal).toHaveBeenCalledTimes(3);
    expect(readObject).toHaveBeenCalledTimes(2);
  });

  it('labels producer data stale only after the documented 48-hour window', () => {
    const data = parseDashboardData({
      ...populatedDashboard,
      generatedAt: '2026-09-01T12:00:00Z'
    });

    expect(isDashboardDataStale(data, Date.parse('2026-09-03T11:59:59Z'))).toBe(
      false
    );
    expect(isDashboardDataStale(data, Date.parse('2026-09-03T12:00:01Z'))).toBe(
      true
    );
  });
});
