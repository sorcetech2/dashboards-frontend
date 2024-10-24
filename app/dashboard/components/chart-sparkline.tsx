'use client';

import { SelfReportedData } from '@/lib/sorce_data';
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTheme
} from 'victory';

interface SparklineChartProps {
  keyName: string;
  data: SelfReportedData[];
}

export default function SparklineChart({ keyName, data }: SparklineChartProps) {
  const sparklineData = data.map((d) => {
    var a = d[`${keyName}_mean` as keyof SelfReportedData];
    if (a === undefined || a === null) {
      a = 0.0;
    }
    return {
      x: new Date(d.date),
      y: a
    };
  });

  return (
    <VictoryChart
      theme={VictoryTheme.clean}
      height={60}
      padding={{ top: 10, bottom: 20, left: 40, right: 40 }}
    >
      <VictoryLine data={sparklineData} style={{ data: { stroke: '#fff' } }} />
      <VictoryAxis tickFormat={() => ''} style={{ axis: { stroke: 'none' } }} />
      <VictoryAxis
        dependentAxis
        tickFormat={() => ''}
        style={{ axis: { stroke: 'none' } }}
      />
    </VictoryChart>
  );
}
