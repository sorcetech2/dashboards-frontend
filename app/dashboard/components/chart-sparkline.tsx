'use client';

import type { SelfReportedData } from '@/lib/sorce_data';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme } from 'victory';

interface SparklineChartProps {
  keyName: string;
  data: SelfReportedData[];
}

export default function SparklineChart({ keyName, data }: SparklineChartProps) {
  const sparklineData = data.flatMap((datum) => {
    const date = new Date(datum.date);
    if (!Number.isFinite(date.getTime())) {
      return [];
    }

    const value = datum[`${keyName}_mean` as keyof SelfReportedData];
    return [
      {
        x: date,
        // Victory treats null y values as gaps; keep missing observations out
        // of the measured-zero bucket.
        y: typeof value === 'number' && Number.isFinite(value) ? value : null
      }
    ];
  });

  const hasValues = sparklineData.some((point) => point.y !== null);
  if (!hasValues) {
    return (
      <div
        className="px-2 pb-4 text-center text-sm text-muted-foreground"
        role="img"
        aria-label={`${keyName} trend: no data available`}
      >
        No data available
      </div>
    );
  }

  return (
    <div role="img" aria-label={`${keyName} trend over time`}>
      <VictoryChart
        theme={VictoryTheme.clean}
        height={60}
        padding={{ top: 10, bottom: 20, left: 40, right: 40 }}
      >
        <VictoryLine
          data={sparklineData}
          style={{ data: { stroke: '#fff' } }}
        />
        <VictoryAxis
          tickFormat={() => ''}
          style={{ axis: { stroke: 'none' } }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={() => ''}
          style={{ axis: { stroke: 'none' } }}
        />
      </VictoryChart>
    </div>
  );
}
