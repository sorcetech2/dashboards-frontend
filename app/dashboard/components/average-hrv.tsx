import type { Chart } from '@/lib/sorce_data';
import { TopCard } from './top-card';
import { Badge } from '@/components/ui/badge';

function formatMetric(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}` : '—';
}

function formatTrend(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

export const AverageHRV = ({ chartData }: { chartData: Chart | undefined }) => {
  const today = chartData?.today?.[0];

  return (
    <TopCard title="Average HRV">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <div className="items-center gap-2 inline-flex">
          <Badge>Weekly</Badge>
          <span className="text-xl font-bold">
            {formatMetric(today?.hrv_this_week_average)}
          </span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(today?.hrv_week_trend_percent)}
          </span>
        </div>

        <div className="items-center gap-2 inline-flex justify-center">
          <Badge>Monthly</Badge>
          <span className="text-xl font-bold">
            {formatMetric(today?.hrv_this_month_average)}
          </span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(today?.hrv_month_trend_percent)}
          </span>
        </div>

        <div className="items-center gap-2 inline-flex justify-end">
          <Badge>3 Months</Badge>
          <span className="text-xl font-bold">
            {formatMetric(today?.hrv_this_quarter_average)}
          </span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(today?.hrv_quarter_trend_percent)}
          </span>
        </div>
      </div>
    </TopCard>
  );
};
