import populatedDashboard from './fixtures/dashboard/populated-dashboard.json';
import populatedTeamStats from './fixtures/dashboard/populated-team-stats.json';
import emptyCharts from './fixtures/dashboard/empty-charts.json';
import emptyTodayLine from './fixtures/dashboard/empty-today-line.json';
import missingMetrics from './fixtures/dashboard/missing-metrics.json';
import malformedPayload from './fixtures/dashboard/malformed-payload.json';
import staleTimestamps from './fixtures/dashboard/stale-timestamps.json';
import monthBoundaryTeamStats from './fixtures/dashboard/month-boundary-team-stats.json';
import { describe, expect, it } from 'vitest';
import {
  DashboardDataContractError,
  STATUS_QUESTION_FIELDS,
  normalizeDashboardData,
  normalizeTeamStats,
  safeParseDashboardData,
  safeParseTeamStats,
  wireTimestampSchema
} from '@/lib/dashboard-data-contract';

describe('dashboard data contract', () => {
  it('normalizes a populated company payload and strips unknown fields', () => {
    const data = normalizeDashboardData(populatedDashboard);
    const [engineering, design] = data.charts;

    expect(data.charts).toHaveLength(2);
    expect(engineering.self_reported_over_time[0]?.date).toBe(
      '2026-09-01T00:00:00.000Z'
    );
    expect(engineering.self_reported_over_time[1]?.date).toBe(
      '2026-09-01T22:00:00.000Z'
    );
    expect(engineering.main.markers[0]?.dataPointIndex).toBe(2);
    expect(engineering.main.rmps[0]?.x).toBe(1788393600000);
    expect(design).not.toHaveProperty('extraProducerField');
    expect(data).not.toHaveProperty('extraProducerField');
  });

  it('accepts an intentionally empty company and chart', () => {
    const empty = normalizeDashboardData(emptyCharts);
    const chart = normalizeDashboardData(emptyTodayLine).charts[0];

    expect(empty.charts).toEqual([]);
    expect(chart?.today).toEqual([]);
    expect(chart?.main.line).toEqual([]);
    expect(chart?.main.markers).toEqual([]);
  });

  it('derives a stable route id for legacy charts whose id is null', () => {
    const data = normalizeDashboardData({
      ...emptyTodayLine,
      charts: [
        {
          ...emptyTodayLine.charts[0],
          id: null,
          name: 'Company Wide'
        }
      ]
    });

    expect(data.charts[0]?.id).toBe('company-wide');
  });

  it('preserves null and zero metrics while filling absent metric fields with null', () => {
    const data = normalizeDashboardData(missingMetrics);
    const chart = data.charts[0];
    const selfReported = chart?.self_reported_over_time[0];
    const today = chart?.today[0];

    expect(chart?.hexaco_chart).toEqual([null, 51, null]);
    expect(selfReported?.sleep_mean).toBeNull();
    expect(selfReported?.activity_mean).toBe(0);
    expect(selfReported?.nutrition_mean).toBeNull();
    expect(today?.engagement_rate).toBeNull();
    expect(today?.hrv_this_week_average).toBeNull();
    expect(today?.sleep_trend).toBeNull();
  });

  it('normalizes stale timestamps without comparing them to browser time', () => {
    const data = normalizeDashboardData(staleTimestamps);
    const chart = data.charts[0];

    expect(chart?.self_reported_over_time[0]?.date).toBe(
      '2020-01-01T00:00:00.000Z'
    );
    expect(chart?.today[0]?.date).toBe('2020-01-02T00:00:00.000Z');
  });

  it('accepts legacy Python timestamps without an offset and normalizes as UTC', () => {
    expect(wireTimestampSchema.parse('2023-11-11T00:00:00.000000')).toBe(
      '2023-11-11T00:00:00.000Z'
    );
    expect(wireTimestampSchema.parse('2023-12-10T00:00:00.000000+0000')).toBe(
      '2023-12-10T00:00:00.000Z'
    );
  });

  it('rejects malformed timestamps with a redacted category', () => {
    const result = safeParseDashboardData(malformedPayload);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(DashboardDataContractError);
    expect(result.error.category).toBe('invalid_timestamp');
    expect(result.error.message).toBe(
      'Dashboard data rejected: invalid_timestamp'
    );
    expect(result.error.message).not.toContain('not-a-timestamp');
  });

  it('rejects RMP date markers that are not valid timestamps', () => {
    const payload = {
      ...emptyTodayLine,
      charts: [
        {
          ...emptyTodayLine.charts[0],
          main: {
            ...emptyTodayLine.charts[0]?.main,
            rmps: [{ x: 'date#2026-13-45', rmp: 'push' }]
          }
        }
      ]
    };
    const result = safeParseDashboardData(payload);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe('invalid_chart');
  });

  it('rejects non-finite chart values at the wire boundary', () => {
    const payload = {
      ...emptyTodayLine,
      charts: [
        {
          ...emptyTodayLine.charts[0],
          main: {
            ...emptyTodayLine.charts[0]?.main,
            line: [{ x: Infinity, y: 2 }]
          }
        }
      ]
    };
    const result = safeParseDashboardData(payload);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe('invalid_chart');
  });
});

describe('team stats data contract', () => {
  it('normalizes multiple teams and recording timestamps', () => {
    const companies = normalizeTeamStats(populatedTeamStats);
    const teams = companies[0]?.stats ?? [];

    expect(teams).toHaveLength(2);
    expect(teams[1]?.recent_recordings[0]).toBe('2026-09-03T14:00:00.000Z');
  });

  it('accepts the migration wrapper and preserves month-boundary ordering', () => {
    const companies = normalizeTeamStats({ companies: monthBoundaryTeamStats });
    const recordings = companies[0]?.stats[0]?.recent_recordings ?? [];

    expect(recordings).toEqual([
      '2026-08-31T23:55:00.000Z',
      '2026-09-01T00:05:00.000Z'
    ]);
  });

  it('returns a redacted team-stats category for malformed payloads', () => {
    const result = safeParseTeamStats([
      {
        company_name: 'Example',
        recent: 'not-a-date',
        stats: []
      }
    ]);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe('invalid_team_stats');
    expect(result.error.message).toBe(
      'Dashboard data rejected: invalid_team_stats'
    );
  });
});

describe('August 2026 status compatibility mapping', () => {
  it('keeps display labels mapped to legacy producer keys', () => {
    expect(
      STATUS_QUESTION_FIELDS.map(({ label, key }) => [label, key])
    ).toEqual([
      ['Physical', 'sleep'],
      ['Emotional', 'nutrition'],
      ['Mental', 'activity'],
      ['Social', 'resilience'],
      ['Purpose', 'productivity']
    ]);
    expect(
      STATUS_QUESTION_FIELDS.map(({ meanKey, trendKey }) => [meanKey, trendKey])
    ).toEqual([
      ['sleep_mean', 'sleep_trend'],
      ['nutrition_mean', 'nutrition_trend'],
      ['activity_mean', 'activity_trend'],
      ['resilience_mean', 'resilience_trend'],
      ['productivity_mean', 'productivity_trend']
    ]);
  });
});
