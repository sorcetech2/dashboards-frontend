import { z } from 'zod';
import type { CompanyStats, SorceData, TeamStats } from './sorce_data';

/**
 * The producer has retained these field names while the customer-facing
 * labels changed in August 2026. Keep this mapping at the wire boundary so a
 * label change cannot silently rename a producer field.
 */
export const STATUS_QUESTION_FIELDS = [
  {
    key: 'sleep',
    label: 'Physical',
    meanKey: 'sleep_mean',
    trendKey: 'sleep_trend'
  },
  {
    key: 'nutrition',
    label: 'Emotional',
    meanKey: 'nutrition_mean',
    trendKey: 'nutrition_trend'
  },
  {
    key: 'activity',
    label: 'Mental',
    meanKey: 'activity_mean',
    trendKey: 'activity_trend'
  },
  {
    key: 'resilience',
    label: 'Social',
    meanKey: 'resilience_mean',
    trendKey: 'resilience_trend'
  },
  {
    key: 'productivity',
    label: 'Purpose',
    meanKey: 'productivity_mean',
    trendKey: 'productivity_trend'
  }
] as const;

/** Alias with a descriptive name for callers that prefer “mapping”. */
export const STATUS_QUESTION_MAPPING = STATUS_QUESTION_FIELDS;

export type StatusQuestionField = (typeof STATUS_QUESTION_FIELDS)[number];

const finiteNumber = z.number().finite();
const nullableMetric = finiteNumber.nullable().default(null);
const nonNegativeCount = finiteNumber.nonnegative().default(0);

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?)?$/;

function canonicalTimestamp(value: string): string | null {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  if (match[4] !== undefined) {
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) return null;
  }

  const hasTime = match[4] !== undefined;
  const hasTimezone = match[7] !== undefined;
  let valueForDate = value;
  if (!hasTime) {
    valueForDate = `${value}T00:00:00Z`;
  } else if (!hasTimezone) {
    // Python's older exports use a naive ISO datetime. Treat it as UTC rather
    // than allowing the host machine's local timezone to shift the day.
    valueForDate = `${value}Z`;
  } else if (/^[+-]\d{4}$/.test(match[7] ?? '')) {
    valueForDate = `${value.slice(0, -5)}${match[7].slice(0, 3)}:${match[7].slice(3)}`;
  }

  const parsed = new Date(valueForDate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/**
 * JSON timestamps are converted to one canonical representation before they
 * reach UI code. Date-only producer values are accepted as UTC midnight for
 * compatibility with older daily exports.
 */
export const wireTimestampSchema = z
  .string()
  .trim()
  .refine((value) => canonicalTimestamp(value) !== null, {
    message: 'invalid timestamp'
  })
  .transform((value) => canonicalTimestamp(value) as string);

const dataPointSchema = z
  .object({
    x: finiteNumber,
    y: nullableMetric
  })
  .strip();

const rangePointSchema = z
  .object({
    x: finiteNumber,
    y: z.tuple([finiteNumber, finiteNumber])
  })
  .strip()
  .superRefine(({ y }, context) => {
    if (y[0] > y[1]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['y'],
        message: 'range lower bound must not exceed upper bound'
      });
    }
  });

const markerSchema = z
  .object({
    seriesIndex: finiteNumber.int().nonnegative(),
    size: finiteNumber.nonnegative(),
    dataPointIndex: finiteNumber.int().nonnegative(),
    fillColor: z.string().trim().min(1),
    strokeColor: z.string().trim().min(1)
  })
  .strip();

const rmpSchema = z
  .object({
    // Older Python exports encode RMP dates as `date#<ISO timestamp>` while
    // newer exports may use the chart's numeric epoch x value.
    x: z.union([
      finiteNumber,
      z
        .string()
        .trim()
        .refine((value) => value.startsWith('date#'), {
          message: 'invalid RMP timestamp'
        })
        .transform((value) => {
          const normalized = canonicalTimestamp(value.slice(5));
          return normalized === null ? z.NEVER : Date.parse(normalized);
        })
    ]),
    rmp: z.string()
  })
  .strip();

function arrayOrEmpty<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (value === null || value === undefined ? [] : value),
    z.array(schema)
  );
}

const mainChartSchema = z
  .object({
    name: z.string().default(''),
    nulls: arrayOrEmpty(dataPointSchema),
    range: arrayOrEmpty(rangePointSchema),
    line: arrayOrEmpty(dataPointSchema),
    min: nullableMetric,
    max: nullableMetric,
    markers: arrayOrEmpty(markerSchema),
    rmps: arrayOrEmpty(rmpSchema)
  })
  .strip();

const selfReportedDataSchema = z
  .object({
    date: wireTimestampSchema,
    sleep_mean: nullableMetric,
    activity_mean: nullableMetric,
    resilience_mean: nullableMetric,
    productivity_mean: nullableMetric,
    nutrition_mean: nullableMetric
  })
  .strip();

const todayDataSchema = z
  .object({
    date: wireTimestampSchema,
    engagement_rate: nullableMetric,
    weekly_engagement_rate: nullableMetric,
    monthly_engagement_rate: nullableMetric,
    alltime_engagement_rate: nullableMetric,
    hrv_this_week_average: nullableMetric,
    hrv_week_trend_percent: nullableMetric,
    hrv_previous_week_average: nullableMetric,
    hrv_this_month_average: nullableMetric,
    hrv_month_trend_percent: nullableMetric,
    hrv_previous_month_average: nullableMetric,
    hrv_this_quarter_average: nullableMetric,
    hrv_quarter_trend_percent: nullableMetric,
    hrv_previous_quarter_average: nullableMetric,
    sleep_mean: nullableMetric,
    sleep_trend: z.string().nullable().default(null),
    activity_mean: nullableMetric,
    activity_trend: z.string().nullable().default(null),
    resilience_mean: nullableMetric,
    resilience_trend: z.string().nullable().default(null),
    productivity_mean: nullableMetric,
    productivity_trend: z.string().nullable().default(null),
    nutrition_mean: nullableMetric,
    nutrition_trend: z.string().nullable().default(null),
    rmp: z.string().nullable().default(null)
  })
  .strip();

export const chartSchema = z
  .object({
    id: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1),
    hexaco_chart: arrayOrEmpty(nullableMetric),
    main: z.preprocess(
      (value) => (value === null || value === undefined ? {} : value),
      mainChartSchema
    ),
    self_reported_over_time: arrayOrEmpty(selfReportedDataSchema),
    today: arrayOrEmpty(todayDataSchema),
    archetype: z.string().default('')
  })
  .strip()
  .transform((chart) => ({
    ...chart,
    id:
      chart.id ??
      (chart.name
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
        'chart')
  }));

/**
 * Company dashboard payload. `schemaVersion` is intentionally optional and
 * unknown fields are stripped so newer producer fields remain forward
 * compatible without being accidentally exposed to the browser.
 */
export const dashboardDataSchema = z
  .object({
    schemaVersion: finiteNumber.int().positive().optional(),
    generatedAt: wireTimestampSchema.optional(),
    tenantId: z.string().trim().min(1).max(200).optional(),
    dataQualityWarnings: arrayOrEmpty(z.string().trim().min(1)).optional(),
    id: finiteNumber,
    name: z.string().trim().min(1),
    logo: z.string().default(''),
    charts: arrayOrEmpty(chartSchema),
    archetype: z.string().default('')
  })
  .strip();

export const teamStatsSchema = z
  .object({
    company_name: z.string().trim().min(1),
    team_name: z.string().trim().min(1),
    total_recordings_count: nonNegativeCount,
    recent_recordings: arrayOrEmpty(wireTimestampSchema),
    recent_active_members: nonNegativeCount,
    total_members: nonNegativeCount
  })
  .strip();

export const companyStatsSchema = z
  .object({
    company_name: z.string().trim().min(1),
    stats: arrayOrEmpty(teamStatsSchema),
    recent: wireTimestampSchema,
    recent_active_members: nonNegativeCount
  })
  .strip();

/** The current producer emits an array; a wrapper is accepted for migrations. */
export const teamStatsPayloadSchema = z.union([
  arrayOrEmpty(companyStatsSchema),
  z
    .object({ companies: arrayOrEmpty(companyStatsSchema) })
    .strip()
    .transform(({ companies }) => companies),
  z
    .object({ data: arrayOrEmpty(companyStatsSchema) })
    .strip()
    .transform(({ data }) => data)
]);

export type DashboardDataContractErrorCategory =
  | 'invalid_payload'
  | 'invalid_timestamp'
  | 'invalid_metric'
  | 'invalid_chart'
  | 'invalid_team_stats';

/** Error intentionally contains a category only; Zod paths/values stay server-side. */
export class DashboardDataContractError extends Error {
  readonly category: DashboardDataContractErrorCategory;

  constructor(category: DashboardDataContractErrorCategory) {
    super(`Dashboard data rejected: ${category}`);
    this.name = 'DashboardDataContractError';
    this.category = category;
  }
}

type ContractFailure = {
  success: false;
  error: DashboardDataContractError;
};

type ContractSuccess<T> = { success: true; data: T };

export type DashboardDataParseResult =
  | ContractSuccess<SorceData>
  | ContractFailure;

export type TeamStatsParseResult =
  | ContractSuccess<CompanyStats[]>
  | ContractFailure;

function classifyDashboardError(
  issues: z.ZodIssue[]
): DashboardDataContractErrorCategory {
  const paths = issues.map((issue) => issue.path.map(String));
  if (paths.some((path) => path.includes('date') || path.includes('recent'))) {
    return 'invalid_timestamp';
  }
  if (
    paths.some((path) =>
      path.some((part) =>
        ['main', 'range', 'line', 'nulls', 'markers', 'rmps'].includes(part)
      )
    )
  ) {
    return 'invalid_chart';
  }
  if (
    paths.some((path) =>
      path.some((part) =>
        [
          'x',
          'y',
          'min',
          'max',
          'hexaco_chart',
          'engagement_rate',
          'hrv_this_week_average',
          'sleep_mean',
          'activity_mean',
          'resilience_mean',
          'productivity_mean',
          'nutrition_mean'
        ].includes(part)
      )
    )
  ) {
    return 'invalid_metric';
  }
  return 'invalid_payload';
}

export function parseDashboardData(input: unknown): SorceData {
  const result = dashboardDataSchema.safeParse(input);
  if (!result.success) {
    throw new DashboardDataContractError(
      classifyDashboardError(result.error.issues)
    );
  }

  return result.data;
}

function parseDashboardDataResult(input: unknown): DashboardDataParseResult {
  try {
    return { success: true, data: parseDashboardData(input) };
  } catch (error) {
    if (error instanceof DashboardDataContractError) {
      return { success: false, error };
    }
  }

  return {
    success: false,
    error: new DashboardDataContractError('invalid_payload')
  };
}

export function safeParseDashboardData(
  input: unknown
): DashboardDataParseResult {
  return parseDashboardDataResult(input);
}

export function normalizeDashboardData(input: unknown): SorceData {
  return parseDashboardData(input);
}

export function parseTeamStats(input: unknown): CompanyStats[] {
  const result = teamStatsPayloadSchema.safeParse(input);
  if (!result.success) {
    throw new DashboardDataContractError('invalid_team_stats');
  }

  return result.data;
}

function parseTeamStatsResult(input: unknown): TeamStatsParseResult {
  try {
    return { success: true, data: parseTeamStats(input) };
  } catch (error) {
    if (error instanceof DashboardDataContractError) {
      return { success: false, error };
    }
  }

  return {
    success: false,
    error: new DashboardDataContractError('invalid_team_stats')
  };
}

export function safeParseTeamStats(input: unknown): TeamStatsParseResult {
  return parseTeamStatsResult(input);
}

export function normalizeTeamStats(input: unknown): CompanyStats[] {
  return parseTeamStats(input);
}

export type { CompanyStats, SorceData, TeamStats };
