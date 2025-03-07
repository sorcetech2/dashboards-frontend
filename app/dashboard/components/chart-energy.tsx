'use client';
import React, { useState, useEffect, useRef } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Label from '@radix-ui/react-label';
import { Button } from '@/components/ui/button';
import { MainChart } from '@/lib/sorce_data';
import {
  VictoryChart,
  VictoryArea,
  VictoryLine,
  VictoryScatter,
  VictoryAxis,
  VictoryTheme,
  createContainer,
  VictoryTooltip
} from 'victory';

interface EnergyChartProps {
  data: MainChart;
}

export default function EnergyChart({ data }: EnergyChartProps) {
  const [currentRange, setCurrentRange] = useState<string>('1month');
  const { range, nulls, line, markers, rmps, min, max } = data;

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

  const [zoomDomain, setZoomDomain] = useState<{ x: [Date, Date] }>({
    x: [new Date(), new Date()]
  });

  const zoomRange = (range: string) => {
    const now = new Date();
    let from: Date;

    switch (range) {
      case 'week':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3month':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        from = new Date(line[0].x);
        break;
      default:
        from = new Date(0); // Beginning of time
        break;
    }

    setCurrentRange(range);
    setZoomDomain({ x: [from, now] });
  };

  useEffect(() => {
    zoomRange('1month');
  }, [data]);

  const VictoryZoomVoronoiContainer = createContainer('zoom', 'voronoi');

  const combinedData = line.map((linePoint, index) => ({
    x: new Date(linePoint.x),
    y: linePoint.y,
    marker: markers[index] || null,
    rmp: rmps.find((r) => r.x === linePoint.x)?.rmp || null
  }));

  const dateButtons = [
    { label: 'Week', value: 'week' },
    { label: '1 month', value: '1month' },
    { label: '3 month', value: '3month' },
    { label: 'All', value: 'all' }
  ];
  console.log(markers);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 ps-3">
          {dateButtons.map((button) => (
            <Button
              key={button.value}
              onClick={() => zoomRange(button.value)}
              variant={currentRange === button.value ? 'default' : 'outline'}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="w-full h-[300px]" ref={containerRef}>
        <VictoryChart
          theme={VictoryTheme.clean}
          scale={{ x: 'time' }}
          padding={{ top: 50, bottom: 50, left: 40, right: 40 }}
          minDomain={{ y: min > 60 ? min - 20 : min }}
          maxDomain={{ y: max + 20 }}
          height={300}
          width={containerWidth}
          containerComponent={
            <VictoryZoomVoronoiContainer
              voronoiBlacklist={['areaChart']}
              labels={({ datum }) => {
                // this is terrible
                return `${datum.x.toLocaleDateString()};${Math.round(datum.y)};${datum.rmp || 'N/A'}`;
              }}
              labelComponent={<CustomLabel />}
              responsive={true}
              zoomDimension="x"
              zoomDomain={zoomDomain}
              onZoomDomainChange={(domain) => {
                if (domain.x) {
                  setZoomDomain({
                    x: [new Date(domain.x[0]), new Date(domain.x[1])]
                  });
                }
              }}
            />
          }
        >
          <VictoryArea
            name="areaChart"
            data={range.map((d) => ({
              x: new Date(d.x),
              y0: d.y[0],
              y: d.y[1]
            }))}
            style={{ data: { fill: '#59616C', opacity: 0.7, stroke: 'none' } }}
          />
          <VictoryLine
            interpolation="cardinal"
            data={nulls.map((d) => ({ x: new Date(d.x), y: d.y }))}
            style={{
              data: { stroke: '#888', strokeDasharray: '4,4', strokeWidth: 2.0 }
            }}
          />
          <VictoryLine
            interpolation="cardinal"
            data={combinedData}
            style={{ data: { stroke: '#CACDCF', strokeWidth: 2.0 } }}
          />
          <VictoryScatter
            data={line.map((linePoint, index) => ({
              x: new Date(linePoint.x),
              y: linePoint.y,
              fillColor: markers[index]?.fillColor
            }))}
            size={6}
            style={{
              data: {
                fill: (d: any) => {
                  return d.datum.fillColor;
                },
                stroke: (d: any) => '#FFFFFF'
              }
            }}
          />
          <VictoryAxis
            tickFormat={(t) => new Date(t).toLocaleDateString()}
            style={{
              axis: { stroke: '#ccc' },
              ticks: { stroke: '#ccc' },
              tickLabels: { fill: '#ccc', fontSize: 12 }
            }}
          />
          <VictoryAxis
            dependentAxis
            tickFormat={(t) => Math.round(t)}
            style={{
              axis: { stroke: '#ccc' },
              ticks: { stroke: '#ccc' },
              tickLabels: { fill: '#ccc', fontSize: 12 }
            }}
          />
        </VictoryChart>
      </div>
      <Legend />
    </div>
  );
}

// Custom label component
const CustomLabel = (props: any) => {
  const { text, datum, x, y } = props;

  // If we don't have valid coordinates, don't render the tooltip
  if (y === undefined || x === undefined) {
    return null;
  }

  let entry = 'No Data';

  // Handle both array and string cases for text
  if (Array.isArray(text)) {
    for (let i = 0; i < text.length; i++) {
      const components = text[i].split(';');
      if (components.length >= 3 && components[2] !== 'N/A') {
        entry = `${components[0]}\nValue: ${components[1]}\nRMP: ${components[2]}`;
        break;
      }
    }
  } else if (typeof text === 'string') {
    const components = text.split(';');
    if (components.length >= 3 && components[2] !== 'N/A') {
      entry = `${components[0]}\nValue: ${components[1]}\nRMP: ${components[2]}`;
    }
  }

  return <VictoryTooltip {...props} text={entry} />;
};

const Legend = () => {
  return (
    <div className="rmp-legend flex flex-row justify-between items-center">
      <div className="line-legend ml-3 text-sm">
        <span className="rect mr-4 align-middle inline-flex gap-2 items-center">
          <i className="a1 inline-block w-[13px] h-[13px] rounded-sm bg-[#59616C]" />
          Baseline
        </span>
        <span className="rect mr-4 align-middle inline-flex gap-2 items-center">
          <i className="a2 inline-block w-[13px] h-[13px] rounded-sm bg-[#CACDCF] shadow-[0_0_4px_#CACDCF]" />
          Energy Level
        </span>
        <span className="rect mr-4 align-middle inline-flex gap-2 items-center">
          <i className="a3 inline-block w-[13px] h-[13px] rounded-sm bg-transparent border border-dashed border-[#888]" />
          Missing Data
        </span>
      </div>
      <div className="dot-legend mr-3 text-sm">
        <span className="rect ml-4 align-middle inline-flex gap-2 items-center">
          <i className="b1 inline-block w-[13px] h-[13px] rounded-full bg-[#4B92FF] border border-white" />
          Push
        </span>
        <span className="rect ml-4 align-middle inline-flex gap-2 items-center">
          <i className="b2 inline-block w-[13px] h-[13px] rounded-full bg-[#C6AEFF] border border-white" />
          Maintain
        </span>
        <span className="rect ml-4 align-middle inline-flex gap-2 items-center">
          <i className="b3 inline-block w-[13px] h-[13px] rounded-full bg-[#24CEAA] border border-white" />
          Recover
        </span>
      </div>
    </div>
  );
};
