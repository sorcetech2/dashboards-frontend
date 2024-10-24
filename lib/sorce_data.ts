type ChartState = {
  data: SorceData | null;
  currentDate: Date | null;
  isLoading: boolean;
  fullDataChart: SorceData | null;
  didFullData: boolean;
  selectedChart: string;
  energyChart: any | null;
};

interface SorceData {
  id: number;
  name: string;
  logo: string;
  charts: Chart[];
}

interface Chart {
  id: string;
  name: string;
  hexaco_chart: number[];
  main: MainChart;
  self_reported_over_time: SelfReportedData[];
  today: TodayData[];
}

interface MainChart {
  name: string;
  nulls: DataPoint[];
  range: RangePoint[];
  line: DataPoint[];
  min: number;
  max: number;
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
  date: string;
  sleep_mean: number | null;
  activity_mean: number | null;
  resilience_mean: number | null;
  productivity_mean: number | null;
  nutrition_mean: number | null;
}

interface TodayData {
  date: string;
  engagement_rate: number;
  weekly_engagement_rate: number;
  monthly_engagement_rate: number;
  alltime_engagement_rate: number;
  hrv_this_week_average: number | null;
  hrv_week_trend_percent: number | null;
  hrv_previous_week_average: number;
  hrv_this_month_average: number;
  hrv_month_trend_percent: number;
  hrv_previous_month_average: number;
  hrv_this_quarter_average: number;
  hrv_quarter_trend_percent: number;
  hrv_previous_quarter_average: number;
  sleep_mean: number | null;
  sleep_trend: string;
  activity_mean: number | null;
  activity_trend: string;
  resilience_mean: number | null;
  resilience_trend: string;
  productivity_mean: number | null;
  productivity_trend: string;
  nutrition_mean: number | null;
  nutrition_trend: string;
  rmp: string | null;
}

interface TeamStats {
  company_name: string;
  team_name: string;
  total_recordings_count: number;
  recent_recordings: Date[];
  recent_active_members: number;
  total_members: number;
}

interface CompanyStats {
  company_name: string;
  stats: TeamStats[];
  recent: Date;
  recent_active_members: number;
}

export type {
  ChartState,
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
