type ChartState = {
  data: SorceData | null;
  currentDate: Date | null;
  isLoading: boolean;
  fullDataChart: SorceData | null;
  didFullData: boolean;
  selectedChart: string;
  energyChart: unknown;
};

/**
 * Timestamp as it crosses the JSON boundary.
 *
 * Runtime payloads contain ISO strings, not `Date` instances. Consumers that
 * need date arithmetic can construct a `Date` from this value after the
 * contract has validated it.
 */
type JsonTimestamp = string;

interface SorceData {
  schemaVersion?: number;
  generatedAt?: JsonTimestamp;
  tenantId?: string;
  dataQualityWarnings?: string[];
  id: number;
  name: string;
  logo: string;
  charts: Chart[];
  archetype: string;
}

interface Chart {
  id: string;
  name: string;
  hexaco_chart: Array<number | null>;
  main: MainChart;
  self_reported_over_time: SelfReportedData[];
  today: TodayData[];
  archetype: string;
}

interface MainChart {
  name: string;
  nulls: DataPoint[];
  range: RangePoint[];
  line: DataPoint[];
  min: number | null;
  max: number | null;
  markers: Marker[];
  rmps: RMP[];
}

interface DataPoint {
  x: number;
  y: number | null;
}

interface RangePoint {
  x: number;
  y: [number, number];
}

interface Marker {
  seriesIndex: number;
  size: number;
  dataPointIndex: number;
  fillColor: string;
  strokeColor: string;
}

interface RMP {
  x: number;
  rmp: string;
}

interface SelfReportedData {
  date: JsonTimestamp;
  sleep_mean?: number | null;
  activity_mean?: number | null;
  resilience_mean?: number | null;
  productivity_mean?: number | null;
  nutrition_mean?: number | null;
}

interface TodayData {
  date: JsonTimestamp;
  engagement_rate?: number | null;
  weekly_engagement_rate?: number | null;
  monthly_engagement_rate?: number | null;
  alltime_engagement_rate?: number | null;
  hrv_this_week_average?: number | null;
  hrv_week_trend_percent?: number | null;
  hrv_previous_week_average?: number | null;
  hrv_this_month_average?: number | null;
  hrv_month_trend_percent?: number | null;
  hrv_previous_month_average?: number | null;
  hrv_this_quarter_average?: number | null;
  hrv_quarter_trend_percent?: number | null;
  hrv_previous_quarter_average?: number | null;
  sleep_mean?: number | null;
  sleep_trend?: string | null;
  activity_mean?: number | null;
  activity_trend?: string | null;
  resilience_mean?: number | null;
  resilience_trend?: string | null;
  productivity_mean?: number | null;
  productivity_trend?: string | null;
  nutrition_mean?: number | null;
  nutrition_trend?: string | null;
  rmp?: string | null;
}

interface TeamStats {
  company_name: string;
  team_name: string;
  total_recordings_count: number;
  recent_recordings: JsonTimestamp[];
  recent_active_members: number;
  total_members: number;
}

interface CompanyStats {
  company_name: string;
  stats: TeamStats[];
  recent: JsonTimestamp;
  recent_active_members: number;
}

export type {
  ChartState,
  JsonTimestamp,
  CompanyStats,
  SorceData,
  Chart,
  MainChart,
  DataPoint,
  RangePoint,
  Marker,
  RMP,
  SelfReportedData,
  TodayData,
  TeamStats
};
