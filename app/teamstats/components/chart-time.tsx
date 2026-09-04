'use client';

import * as React from 'react';
import type { TeamStats } from '@/lib/sorce_data';
import {
  VictoryAxis,
  VictoryChart,
  VictoryScatter,
  VictoryTheme,
  VictoryTooltip,
  VictoryVoronoiContainer
} from 'victory';

interface ChartDataPoint {
  x: Date;
  time: number;
  company: string;
  team: string;
  timestamp: string;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(time: number): string {
  const totalMinutes = Math.round(time * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
}

function formatDateTick(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number' || typeof value === 'string'
        ? new Date(value)
        : null;

  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })
    : '';
}

export default function RecordingsScatterPlot({ data }: { data: TeamStats[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const chartData = React.useMemo<ChartDataPoint[]>(
    () =>
      (Array.isArray(data) ? data : [])
        .flatMap((team) =>
          (Array.isArray(team.recent_recordings)
            ? team.recent_recordings
            : []
          ).flatMap((recordedAt) => {
            const date = new Date(recordedAt);
            if (Number.isNaN(date.getTime())) return [];

            return [
              {
                x: date,
                time:
                  date.getHours() +
                  date.getMinutes() / 60 +
                  date.getSeconds() / 3600,
                company: team.company_name,
                team: team.team_name,
                timestamp: date.toLocaleString()
              }
            ];
          })
        )
        .sort((left, right) => left.x.getTime() - right.x.getTime()),
    [data]
  );

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (chartData.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No recordings are available for the last 10 days.
      </p>
    );
  }

  const latestPoint = chartData[chartData.length - 1];
  if (!latestPoint) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No recordings are available for the last 10 days.
      </p>
    );
  }

  const latest = latestPoint.x;
  const end = startOfLocalDay(latest);
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 10);
  const visibleData = chartData.filter(
    (point) => point.x >= start && point.x < end
  );
  const tickValues = Array.from({ length: 10 }, (_, index) => {
    const tick = new Date(start);
    tick.setDate(tick.getDate() + index);
    return tick;
  });

  return (
    <figure className="w-full" aria-labelledby="recordings-chart-caption">
      <figcaption id="recordings-chart-caption" className="sr-only">
        Recording timestamps for the 10-day period ending{' '}
        {latest.toLocaleDateString()}, positioned by date and time of day.
      </figcaption>
      <div className="h-96 w-full" ref={containerRef}>
        {containerWidth > 0 && (
          <VictoryChart
            theme={VictoryTheme.clean}
            scale={{ x: 'time', y: 'linear' }}
            domain={{ x: [start, end], y: [0, 24] }}
            height={400}
            width={containerWidth}
            padding={{ top: 25, right: 30, bottom: 55, left: 65 }}
            containerComponent={
              <VictoryVoronoiContainer
                labels={({ datum }: { datum: ChartDataPoint }) =>
                  `${datum.company} / ${datum.team}\n${datum.timestamp}`
                }
                labelComponent={
                  <VictoryTooltip
                    constrainToVisibleArea
                    style={{ fontSize: 11 }}
                  />
                }
              />
            }
          >
            <VictoryAxis
              tickValues={tickValues}
              tickFormat={(value: unknown) => formatDateTick(value)}
              label="Recording date"
              style={{
                tickLabels: { fill: '#ccc', fontSize: 11, angle: -35 },
                axisLabel: { fill: 'white', fontSize: 14, padding: 42 }
              }}
            />
            <VictoryAxis
              dependentAxis
              tickValues={Array.from({ length: 13 }, (_, index) => index * 2)}
              tickFormat={(value: unknown) =>
                typeof value === 'number' ? formatTime(value) : ''
              }
              label="Time of day"
              style={{
                tickLabels: { fill: '#ccc', fontSize: 12 },
                axisLabel: { fill: 'white', fontSize: 14, padding: 48 }
              }}
            />
            <VictoryScatter
              data={visibleData}
              y="time"
              size={4}
              style={{ data: { fill: '#8884d8' } }}
            />
          </VictoryChart>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          View recording timestamps as a table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-left">
            <caption className="sr-only">
              Recording timestamps for the selected ten-day period
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2 font-medium">
                  Team
                </th>
                <th scope="col" className="p-2 font-medium">
                  Recorded at
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((point, index) => (
                <tr
                  key={`${point.team}-${point.x.toISOString()}-${index}`}
                  className="border-b last:border-0"
                >
                  <td className="p-2">{point.team}</td>
                  <td className="p-2">{point.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
