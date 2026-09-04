import type { Chart } from '@/lib/sorce_data';
import { TopCard } from './top-card';
import { Badge } from '@/components/ui/badge';

function formatPercentage(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value}%`
    : '—';
}

export const EngagementRate = ({
  chartData
}: {
  chartData: Chart | undefined;
}) => {
  const today = chartData?.today?.[0];

  return (
    <div className="md:col-span-3">
      <TopCard title="Engagement Rate">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="items-center gap-2 inline-flex">
            <Badge>Today</Badge>
            <span className="text-xl font-bold">
              {formatPercentage(today?.engagement_rate)}
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>Weekly</Badge>
            <span className="text-xl font-bold">
              {formatPercentage(today?.weekly_engagement_rate)}
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>Monthly</Badge>
            <span className="text-xl font-bold">
              {formatPercentage(today?.monthly_engagement_rate)}
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>All-Time</Badge>
            <span className="text-xl font-bold">
              {formatPercentage(today?.alltime_engagement_rate)}
            </span>
          </div>
        </div>
      </TopCard>
    </div>
  );
};
