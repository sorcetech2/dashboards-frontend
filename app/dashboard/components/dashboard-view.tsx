import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Chart, SorceData } from '@/lib/sorce_data';
import { rmpColor } from '@/lib/utils';
import { AverageHRV } from './average-hrv';
import EnergyChart from './chart-energy';
import { DashboardHeader } from './dashboard-header';
import { EngagementRate } from './engagement-rate';
import HexacoSection from './hexaco-section';
import StatusSection from './status-section';
import { TeamSwitcher, type SwitchableTeam } from './team-switcher';
import { TopCard } from './top-card';

export function DashboardView({
  data,
  chartData,
  isAdmin,
  isStale
}: {
  data: SorceData;
  chartData: Chart;
  isAdmin: boolean;
  isStale: boolean;
}) {
  const allCharts: SwitchableTeam[] = data.charts.map((chart) => ({
    name: chart.name,
    value: chart.id
  }));
  const today = chartData.today[0];
  const rmp = today?.rmp?.trim() || null;
  const color = rmp ? rmpColor(rmp) : '#888888';
  const sourceDate = data.generatedAt ?? today?.date;
  const dataDate = sourceDate
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
        new Date(sourceDate)
      )
    : null;
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader isAdmin={isAdmin}>
        <TeamSwitcher teams={allCharts} />
      </DashboardHeader>
      <main
        id="main-content"
        className="flex-1 space-y-4 p-4 pt-6 md:p-8 md:pt-6"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          {dataDate && (
            <p className="inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold text-gray-400">
              Last update {dataDate}
            </p>
          )}
          {isStale && (
            <p className="text-sm text-amber-300" role="status">
              This dashboard may be stale; it was generated more than 48 hours
              ago.
            </p>
          )}
          {data.dataQualityWarnings && data.dataQualityWarnings.length > 0 && (
            <p className="text-sm text-amber-300" role="status">
              Some source data is incomplete.
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <TopCard
                title="Today's Energy Status"
                help="If a person's HRV indicates a high degree of stress and lack of recovery they will get a RECOVER HRV score. If a person is somewhat recovered but not ready for higher intensity they get a MAINTAIN. If a person is fully recovered and ready to push the limits they will get a PUSH."
              >
                <div className="flex items-center text-xl font-bold">
                  <svg
                    aria-hidden="true"
                    width="24"
                    height="24"
                    className="mr-2 inline-block"
                  >
                    <circle cx="10" cy="10" r="8" fill={color} />
                  </svg>
                  {rmp
                    ? rmp.charAt(0).toUpperCase() + rmp.slice(1).toLowerCase()
                    : 'No data'}
                </div>
              </TopCard>
            </div>
            <EngagementRate chartData={chartData} />
          </div>

          <AverageHRV chartData={chartData} />

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <EnergyChart data={chartData.main} />
            </CardContent>
          </Card>

          <StatusSection chartData={chartData} />
          <HexacoSection chartData={chartData} />
        </div>
      </main>
    </div>
  );
}
