import { SorceData, ChartState, TodayData, Chart } from '@/lib/sorce_data';
import { TopCard, HelpTooltip } from './top-card';
import { Badge } from '@/components/ui/badge';
import { rmpColor } from '@/lib/utils';


export const AverageHRV = ({ chartData }: { chartData: Chart | undefined }) => {
  var averageHrvWeekly = 0;
  var averageHrvMonthly = 0;
  var averageHrv3Months = 0;

  var hrv_week_trend_percent = 0;
  var hrv_month_trend_percent = 0;
  var hrv_quarter_trend_percent = 0;


  if (chartData && chartData.today.length > 0) {
    averageHrvWeekly = chartData.today[0].hrv_this_week_average || 0;
    averageHrvMonthly = chartData.today[0].hrv_this_month_average || 0;
    averageHrv3Months = chartData.today[0].hrv_this_quarter_average || 0;

    hrv_week_trend_percent = chartData.today[0].hrv_week_trend_percent || 0;
    hrv_month_trend_percent = chartData.today[0].hrv_month_trend_percent || 0;
    hrv_quarter_trend_percent =
      chartData.today[0].hrv_quarter_trend_percent || 0;
  }

  function formatTrend(trend: number): string {
    if (trend > 0) {
      return `+${trend}`;
    } else if (trend == 0) {
      return '';
    } else {
      return `${trend}`;
    }
  }

  return (
    <TopCard title="Average HRV">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <div className="items-center gap-2 inline-flex">
          <Badge>Weekly</Badge>
          <span className="text-xl font-bold">{averageHrvWeekly}%</span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(hrv_week_trend_percent)}
          </span>
        </div>

        <div className="items-center gap-2 inline-flex justify-center">
          <Badge>Monthly</Badge>
          <span className="text-xl font-bold">
            {averageHrvMonthly}%
          </span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(hrv_month_trend_percent)}
          </span>
        </div>

        <div className="items-center gap-2 inline-flex justify-end">
          <Badge>3 Months</Badge>
          <span className="text-xl font-bold">
            {averageHrv3Months}%
          </span>
          <span className="text-xl text-muted-foreground">
            {formatTrend(hrv_quarter_trend_percent)}
          </span>
        </div>
      </div>
    </TopCard>
  )
}