'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  VictoryChart,
  VictoryScatter,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
  VictoryTheme
} from 'victory';

interface TeamStats {
  company_name: string;
  team_name: string;
  total_recordings_count: number;
  recent_recordings: Date[];
  recent_active_members: number;
  total_members: number;
}

interface ChartDataPoint {
  day: number;
  time: number;
  company: string;
  team: string;
  timestamp: string;
}

const RecordingsScatterPlot = ({ data }: { data: TeamStats[] }) => {
  // Transform the data into the format needed for the scatter plot
  const chartData: ChartDataPoint[] = data.flatMap((team) =>
    team.recent_recordings.map((date) => {
      const dateObj = new Date(date);
      return {
        day: dateObj.getDate(),
        time: dateObj.getHours() + dateObj.getMinutes() / 60,
        company: team.company_name,
        team: team.team_name,
        timestamp: dateObj.toLocaleString()
      };
    })
  );

  // Format time for the y-axis
  const formatYAxis = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div className="w-full h-96" ref={containerRef}>
      <VictoryChart
        theme={VictoryTheme.clean}
        domain={{ x: [1, 31], y: [0, 24] }}
        height={400}
        width={containerWidth}
      >
        <VictoryAxis
          tickValues={Array.from({ length: 31 }, (_, i) => i + 1)}
          label="Day of Month"
          style={{
            tickLabels: { fill: '#ccc', fontSize: 12 },
            axisLabel: { fill: 'white', fontSize: 14, padding: 30 }
          }}
        />
        <VictoryAxis
          dependentAxis
          tickValues={Array.from({ length: 13 }, (_, i) => i * 2)}
          tickFormat={formatYAxis}
          label="Time of Day"
          style={{
            tickLabels: { fill: '#ccc', fontSize: 12 },
            axisLabel: { fill: 'white', fontSize: 14, padding: 50 }
          }}
        />
        <VictoryScatter
          data={chartData}
          x="day"
          y="time"
          style={{ data: { fill: '#8884d8' } }}
        />
      </VictoryChart>
    </div>
  );
};

export default RecordingsScatterPlot;
