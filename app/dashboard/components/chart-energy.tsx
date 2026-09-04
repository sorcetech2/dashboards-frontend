'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import type { MainChart, Marker } from '@/lib/sorce_data';
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryScatter,
  VictoryTheme,
  VictoryTooltip,
  createContainer
} from 'victory';

interface EnergyChartProps {
  data: MainChart;
}

type DateRange = 'week' | '1month' | '3month' | 'all';
type ZoomDomain = { x: [Date, Date] };
type ZoomSelection = {
  datasetKey: string;
  range: DateRange;
  domain: ZoomDomain;
};

interface EnergyPoint {
  x: Date;
  y: number;
  marker: Marker | null;
  rmp: string | null;
}

function energyPointFromDatum(value: unknown): EnergyPoint | null {
  if (typeof value !== 'object' || value === null) return null;

  const point = value as Partial<EnergyPoint>;
  return point.x instanceof Date && typeof point.y === 'number'
    ? (point as EnergyPoint)
    : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ZoomVoronoiContainer = createContainer('zoom', 'voronoi');

function validDate(value: number): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extentForRange(
  range: DateRange,
  first: Date,
  latest: Date
): ZoomDomain {
  const duration =
    range === 'week'
      ? 7 * DAY_MS
      : range === '1month'
        ? 30 * DAY_MS
        : range === '3month'
          ? 90 * DAY_MS
          : latest.getTime() - first.getTime();
  const from = new Date(Math.max(first.getTime(), latest.getTime() - duration));

  if (from.getTime() === latest.getTime()) {
    return { x: [new Date(from.getTime() - DAY_MS), latest] };
  }

  return { x: [from, latest] };
}

export default function EnergyChart({ data }: EnergyChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const markerByIndex = React.useMemo(
    () =>
      new Map(
        (data.markers ?? []).map((marker) => [marker.dataPointIndex, marker])
      ),
    [data.markers]
  );
  const rmpByTimestamp = React.useMemo(
    () => new Map((data.rmps ?? []).map((entry) => [entry.x, entry.rmp])),
    [data.rmps]
  );
  const lineData = React.useMemo<EnergyPoint[]>(
    () =>
      (data.line ?? [])
        .map((point, index) => {
          const x = validDate(point.x);
          if (!x || typeof point.y !== 'number' || !Number.isFinite(point.y)) {
            return null;
          }

          return {
            x,
            y: point.y,
            marker: markerByIndex.get(index) ?? null,
            rmp: rmpByTimestamp.get(point.x) ?? null
          };
        })
        .filter((point): point is EnergyPoint => point !== null)
        .sort((left, right) => left.x.getTime() - right.x.getTime()),
    [data.line, markerByIndex, rmpByTimestamp]
  );

  const firstDate = lineData[0]?.x ?? null;
  const latestDate = lineData.at(-1)?.x ?? null;
  const initialDomain = React.useMemo<ZoomDomain | null>(() => {
    if (!firstDate || !latestDate) return null;
    return extentForRange('1month', firstDate, latestDate);
  }, [firstDate, latestDate]);
  const datasetKey = `${firstDate?.getTime() ?? ''}:${latestDate?.getTime() ?? ''}:${lineData.length}`;
  const [zoomSelection, setZoomSelection] =
    React.useState<ZoomSelection | null>(null);
  const activeSelection =
    zoomSelection?.datasetKey === datasetKey ? zoomSelection : null;
  const currentRange = activeSelection?.range ?? '1month';
  const zoomDomain = activeSelection?.domain ?? initialDomain;

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

  const selectRange = (range: DateRange) => {
    if (firstDate && latestDate) {
      setZoomSelection({
        datasetKey,
        range,
        domain: extentForRange(range, firstDate, latestDate)
      });
    }
  };

  if (!zoomDomain || lineData.length === 0 || !firstDate || !latestDate) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No energy data is available for this team.
      </div>
    );
  }

  const rangeData = (data.range ?? [])
    .map((point) => {
      const x = validDate(point.x);
      return x &&
        Array.isArray(point.y) &&
        point.y.length >= 2 &&
        point.y.every(
          (value) => typeof value === 'number' && Number.isFinite(value)
        )
        ? { x, y0: point.y[0], y: point.y[1] }
        : null;
    })
    .filter(
      (point): point is { x: Date; y0: number; y: number } => point !== null
    )
    .sort((left, right) => left.x.getTime() - right.x.getTime());
  const nullData = (data.nulls ?? [])
    .map((point) => {
      const x = validDate(point.x);
      const y = point.y;
      return x && (y === null || (typeof y === 'number' && Number.isFinite(y)))
        ? { x, y }
        : null;
    })
    .filter((point): point is { x: Date; y: number | null } => point !== null)
    .sort((left, right) => left.x.getTime() - right.x.getTime());
  const finiteValues = lineData.map((point) => point.y);
  const suppliedMin =
    typeof data.min === 'number' && Number.isFinite(data.min)
      ? data.min
      : Math.min(...finiteValues);
  const suppliedMax =
    typeof data.max === 'number' && Number.isFinite(data.max)
      ? data.max
      : Math.max(...finiteValues);
  const minDomain = suppliedMin > 50 ? suppliedMin - 10 : suppliedMin;
  const maxDomain = suppliedMax + 10;

  const dateButtons: Array<{ label: string; value: DateRange }> = [
    { label: 'Week', value: 'week' },
    { label: '1 month', value: '1month' },
    { label: '3 months', value: '3month' },
    { label: 'All', value: 'all' }
  ];

  return (
    <figure className="w-full" aria-labelledby="energy-chart-caption">
      <figcaption id="energy-chart-caption" className="sr-only">
        Team energy level over time, including its baseline range and Push,
        Maintain, or Recover status markers. The latest data point is dated{' '}
        {latestDate.toLocaleDateString()}.
      </figcaption>
      <div
        className="flex flex-wrap items-center gap-2 ps-3"
        role="group"
        aria-label="Energy chart date range"
      >
        {dateButtons.map((button) => (
          <Button
            key={button.value}
            type="button"
            onClick={() => selectRange(button.value)}
            variant={currentRange === button.value ? 'default' : 'outline'}
            aria-pressed={currentRange === button.value}
          >
            {button.label}
          </Button>
        ))}
      </div>
      <div className="h-[300px] w-full" ref={containerRef}>
        {containerWidth > 0 && (
          <VictoryChart
            theme={VictoryTheme.clean}
            scale={{ x: 'time' }}
            padding={{ top: 50, bottom: 50, left: 40, right: 40 }}
            minDomain={{ y: minDomain }}
            maxDomain={{ y: maxDomain }}
            height={300}
            width={containerWidth}
            containerComponent={
              <ZoomVoronoiContainer
                voronoiBlacklist={['areaChart', 'missingData']}
                labels={({ datum }: { datum: EnergyPoint }) => {
                  const date = datum.x;
                  const value = Math.round(datum.y);
                  if (Number.isNaN(date.getTime()) || value === null) return '';
                  return `${date.toLocaleDateString()};${value};${datum.rmp ?? 'N/A'}`;
                }}
                labelComponent={<CustomLabel />}
                responsive
                zoomDimension="x"
                zoomDomain={zoomDomain}
                onZoomDomainChange={(domain) => {
                  if (domain.x) {
                    setZoomSelection({
                      datasetKey,
                      range: currentRange,
                      domain: {
                        x: [new Date(domain.x[0]), new Date(domain.x[1])]
                      }
                    });
                  }
                }}
              />
            }
          >
            <VictoryArea
              name="areaChart"
              data={rangeData}
              style={{
                data: { fill: '#59616C', opacity: 0.7, stroke: 'none' }
              }}
            />
            <VictoryLine
              name="missingData"
              interpolation="cardinal"
              data={nullData}
              style={{
                data: {
                  stroke: '#888',
                  strokeDasharray: '4,4',
                  strokeWidth: 2
                }
              }}
            />
            <VictoryLine
              interpolation="cardinal"
              data={lineData}
              style={{ data: { stroke: '#CACDCF', strokeWidth: 2 } }}
            />
            <VictoryScatter
              data={lineData}
              size={({ datum }: { datum?: unknown }) =>
                energyPointFromDatum(datum)?.marker ? 6 : 0
              }
              style={{
                data: {
                  fill: ({ datum }: { datum?: unknown }) =>
                    energyPointFromDatum(datum)?.marker?.fillColor ??
                    'transparent',
                  stroke: ({ datum }: { datum?: unknown }) =>
                    energyPointFromDatum(datum)?.marker?.strokeColor ??
                    'transparent'
                }
              }}
            />
            <VictoryAxis
              tickFormat={(tick: unknown) => formatDateTick(tick)}
              style={{
                axis: { stroke: '#ccc' },
                ticks: { stroke: '#ccc' },
                tickLabels: { fill: '#ccc', fontSize: 12 }
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(tick: unknown) =>
                typeof tick === 'number' ? Math.round(tick) : ''
              }
              style={{
                axis: { stroke: '#ccc' },
                ticks: { stroke: '#ccc' },
                tickLabels: { fill: '#ccc', fontSize: 12 }
              }}
            />
          </VictoryChart>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          View energy data as a table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-left">
            <caption className="sr-only">
              Energy measurements, statuses, and RMP labels
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2 font-medium">
                  Recorded at
                </th>
                <th scope="col" className="p-2 font-medium">
                  Energy
                </th>
                <th scope="col" className="p-2 font-medium">
                  RMP
                </th>
              </tr>
            </thead>
            <tbody>
              {lineData.map((point, index) => (
                <tr
                  key={`${point.x.toISOString()}-${index}`}
                  className="border-b last:border-0"
                >
                  <td className="p-2">{point.x.toLocaleString()}</td>
                  <td className="p-2">{point.y}</td>
                  <td className="p-2">{point.rmp ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Legend />
    </figure>
  );
}

function formatDateTick(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number' || typeof value === 'string'
        ? new Date(value)
        : null;

  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString()
    : '';
}

function CustomLabel(props: React.ComponentProps<typeof VictoryTooltip>) {
  const { text, x, y } = props;
  if (y === undefined || x === undefined) return null;

  const entries: unknown[] = Array.isArray(text) ? text : [text];
  const parsedEntries = entries.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    const components = entry.split(';');
    return components.length >= 3 ? [components] : [];
  });
  const [date, value, rmp] =
    parsedEntries.find((components) => components[2] !== 'N/A') ??
    parsedEntries[0] ??
    [];

  if (!date || !value || !rmp) return null;
  return (
    <VictoryTooltip {...props} text={`${date}\nValue: ${value}\nRMP: ${rmp}`} />
  );
}

function Legend() {
  return (
    <div className="rmp-legend flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="line-legend ml-3 flex flex-wrap items-center gap-4">
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="a1 inline-block h-[13px] w-[13px] rounded-sm bg-[#59616C]"
          />
          Baseline
        </span>
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="a2 inline-block h-[13px] w-[13px] rounded-sm bg-[#CACDCF] shadow-[0_0_4px_#CACDCF]"
          />
          Energy Level
        </span>
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="a3 inline-block h-[13px] w-[13px] rounded-sm border border-dashed border-[#888] bg-transparent"
          />
          Missing Data
        </span>
      </div>
      <div className="dot-legend mr-3 flex flex-wrap items-center gap-4">
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="b1 inline-block h-[13px] w-[13px] rounded-full border border-white bg-[#4B92FF]"
          />
          Push
        </span>
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="b2 inline-block h-[13px] w-[13px] rounded-full border border-white bg-[#C6AEFF]"
          />
          Maintain
        </span>
        <span className="rect inline-flex items-center gap-2 align-middle">
          <i
            aria-hidden="true"
            className="b3 inline-block h-[13px] w-[13px] rounded-full border border-white bg-[#24CEAA]"
          />
          Recover
        </span>
      </div>
    </div>
  );
}
