'use client';
import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip
} from 'recharts';
import { Badge } from '@/components/ui/badge';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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
          {payload[0].payload.title}{' '}
          <Badge variant="secondary">{Math.round(payload[0].value)}</Badge>
        </h3>
        <p className="text-sm text-gray-700">
          {payload[0].payload.description}
        </p>
      </div>
    );
  }

  return null;
};

interface HexacoChartProps {
  hexacoData: number[];
  dimensionNames: Record<string, string>;
  dimensionDescriptions: Record<string, string>;
}

export default function HexacoChart({
  hexacoData,
  dimensionNames,
  dimensionDescriptions
}: HexacoChartProps) {
  const dimensions = ['H', 'E', 'X', 'A', 'C', 'O'];
  const data = dimensions.map((dim, index) => ({
    subject: dim,
    value: hexacoData[index],
    title: dimensionNames[dim],
    description: dimensionDescriptions[dim]
  }));

  return (
    <RadarChart
      cx={300}
      cy={250}
      outerRadius={150}
      width={600}
      height={500}
      data={data}
    >
      <PolarGrid radialLines={true} polarRadius={[0]} />
      <Tooltip content={CustomTooltip} />
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
  );
}
