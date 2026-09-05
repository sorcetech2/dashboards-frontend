'use client';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps
} from 'recharts';
import { Badge } from '@/components/ui/badge';

interface HexacoDatum {
  subject: string;
  value: number;
  title: string;
  description: string;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  const point = payload?.[0]?.payload as HexacoDatum | undefined;
  const value = payload?.[0]?.value;

  if (active && point && typeof value === 'number') {
    return (
      <div
        className="custom-tooltip"
        style={{
          backgroundColor: '#fff',
          padding: '5px',
          border: '1px solid #ccc',
          maxWidth: '200px'
        }}
      >
        <h3 className="text-sm font-bold text-gray-900">
          {point.title} <Badge variant="secondary">{Math.round(value)}</Badge>
        </h3>
        <p className="text-sm text-gray-700">{point.description}</p>
      </div>
    );
  }

  return null;
};

interface HexacoChartProps {
  hexacoData: Array<number | null | undefined>;
  dimensionNames: Record<string, string>;
  dimensionDescriptions: Record<string, string>;
}

export default function HexacoChart({
  hexacoData,
  dimensionNames,
  dimensionDescriptions
}: HexacoChartProps) {
  const dimensions = ['H', 'E', 'X', 'A', 'C', 'O'];
  const data = dimensions.flatMap<HexacoDatum>((dim, index) => {
    const value = hexacoData[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return [];
    }

    return [
      {
        subject: dim,
        value,
        title: dimensionNames[dim] ?? dim,
        description: dimensionDescriptions[dim] ?? 'No description available.'
      }
    ];
  });

  if (data.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No personality data available
      </p>
    );
  }

  return (
    <div
      className="h-[min(75vw,28rem)] min-h-[18rem] w-full"
      role="img"
      aria-label="HEXACO personality profile"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid radialLines={true} polarRadius={[0]} />
          <Tooltip content={<CustomTooltip />} />
          <PolarAngleAxis dataKey="subject" />
          <Radar
            name="Values"
            dataKey="value"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
            dot={{ fill: '#8884d8', strokeWidth: 2, stroke: '#fff', r: 5 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
