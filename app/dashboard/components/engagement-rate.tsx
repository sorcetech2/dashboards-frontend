import { SorceData, ChartState, TodayData, Chart } from '@/lib/sorce_data';
import { TopCard, HelpTooltip } from './top-card';
import { Badge } from '@/components/ui/badge';


export const EngagementRate = ({ chartData }: { chartData: Chart | undefined }) => {
  var engagementToday = 0;
  var engagementWeekly = 0;
  var engagementMonthly = 0;
  var engagementAlltime = 0;

  var averageHrvWeekly = 0;
  var averageHrvMonthly = 0;
  var averageHrv3Months = 0;

  var hrv_week_trend_percent = 0;
  var hrv_month_trend_percent = 0;
  var hrv_quarter_trend_percent = 0;

  if (chartData && chartData.today.length > 0) {
    engagementToday = chartData.today[0].engagement_rate || 0;
    engagementWeekly = chartData.today[0].weekly_engagement_rate || 0;
    engagementMonthly = chartData.today[0].monthly_engagement_rate || 0;
    engagementAlltime = chartData.today[0].alltime_engagement_rate || 0;
    averageHrvWeekly = chartData.today[0].hrv_this_week_average || 0;
    averageHrvMonthly = chartData.today[0].hrv_this_month_average || 0;
    averageHrv3Months = chartData.today[0].hrv_this_quarter_average || 0;

    hrv_week_trend_percent = chartData.today[0].hrv_week_trend_percent || 0;
    hrv_month_trend_percent = chartData.today[0].hrv_month_trend_percent || 0;
    hrv_quarter_trend_percent =
      chartData.today[0].hrv_quarter_trend_percent || 0;
  }

  return (
    <div className="md:col-span-3">
      <TopCard title="Engagement Rate">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="items-center gap-2 inline-flex">
            <Badge>Today</Badge>
            <span className="text-xl font-bold">
              {engagementToday}%
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>Weekly</Badge>
            <span className="text-xl font-bold">
              {engagementWeekly}%
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>Monthly</Badge>
            <span className="text-xl font-bold">
              {engagementMonthly}%
            </span>
          </div>

          <div className="items-center gap-2 inline-flex">
            <Badge>All-Time</Badge>
            <span className="text-xl font-bold">
              {engagementAlltime}%
            </span>
          </div>
        </div>
      </TopCard>
    </div>
  )
}