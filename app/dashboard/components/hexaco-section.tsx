'use client';

import * as React from 'react';
import { Chart } from '@/lib/sorce_data';
import { HelpTooltip } from './top-card';
import HexacoChart from './chart-hexaco';

interface HexacoSectionProps {
  chartData: Chart | undefined;
}

export default function HexacoSection({ chartData }: HexacoSectionProps) {
  const dimensionNames = {
    H: 'Honesty-Humility',
    E: 'Emotionality',
    X: 'eXtraversion',
    A: 'Agreeableness',
    C: 'Conscientiousness',
    O: 'Openness to Experience'
  };
  const dimensionDescriptions = {
    H: "Teams' propensity to be sincere, fair, and modest versus manipulative, deceitful, and boastful.",
    E: "Team members' level of emotional attachment and concern for others, impacting team empathy and support.",
    X: 'Reflects the degree of social assertiveness, activity, and enthusiasm in the team, affecting group dynamics.',
    A: "Indicates a team's cooperativeness and tolerance versus antagonism, affecting conflict resolution and cooperation.",
    C: 'Measures the level of organization, diligence, and reliability within the team, essential for meeting deadlines and achieving goals.',
    O: "Relates to the team's openness to new experiences and creative problem-solving, fostering innovation and adaptability."
  };

  const identifiers = ['H', 'E', 'X', 'A', 'C', 'O'];
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
      <div className="pt-3 ps-1 pb-2">
        <h3 className="text-xl font-bold items-center inline-flex gap-2">
          Personality Insights
          <HelpTooltip>
            The HEXACO chart offers an overview of team personality profiles.It
            serves as a valuable tool for understanding and optimizing team
            interactions, collaboration, and overall productivity.
          </HelpTooltip>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="items-center flex justify-center">
            {/* {chartData?.hexaco_chart && HexacoChart(chartData.hexaco_chart)} */}
            {chartData?.hexaco_chart && (
              <HexacoChart
                hexacoData={chartData.hexaco_chart}
                dimensionNames={dimensionNames}
                dimensionDescriptions={dimensionDescriptions}
              />
            )}
          </div>
          <div>
            <div className="mb-4">
              {chartData?.archetype && <>
                <h3 className="text-m font-semibold">Archetype: {chartData?.archetype}</h3>
                <p className="text-sm text-gray-500">
                  {chartData?.archetype}
                </p>
              </>}
            </div>
          </div>
          {/* <div className="hidden">
            {identifiers.map((identifier) => (
              <div key={identifier} className="mb-4">
                <h3 className="text-m font-semibold">
                  {dimensionNames[identifier as keyof typeof dimensionNames]}
                </h3>
                <p className="text-sm text-gray-500">
                  {
                    dimensionDescriptions[
                      identifier as keyof typeof dimensionDescriptions
                    ]
                  }
                </p>
              </div>
            ))}
          </div> */}
        </div>
      </div>
    </div>
  );
}
