'use client';

import { TodayData, Chart } from '@/lib/sorce_data';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from './top-card';
import { Brain, Heart, HeartPulse, Sparkles, UsersRound } from 'lucide-react';
import SparklineChart from './chart-sparkline';

interface StatusSectionProps {
  chartData: Chart | undefined;
}

// Question labels were renamed in August 2026; preserve the legacy data keys.
// Source: Jess's Slack message: https://sorce-group.slack.com/archives/C04DKTKE95K/p1787332121750919
const statusQuestions = [
  {
    key: 'sleep',
    label: 'Physical',
    tooltip: 'Answers to the question: How resourced does your body feel?',
    Icon: HeartPulse
  },
  {
    key: 'nutrition',
    label: 'Emotional',
    tooltip: 'Answers to the question: How emotionally settled do you feel?',
    Icon: Heart
  },
  {
    key: 'activity',
    label: 'Mental',
    tooltip: 'Answers to the question: How clear does your mind feel?',
    Icon: Brain
  },
  {
    key: 'resilience',
    label: 'Social',
    tooltip: 'Answers to the question: How connected do you feel to others?',
    Icon: UsersRound
  },
  {
    key: 'productivity',
    label: 'Purpose',
    tooltip: 'Answers to the question: How inspired do you feel today?',
    Icon: Sparkles
  }
] as const;

export default function StatusSection({ chartData }: StatusSectionProps) {
  return (
    <>
      <div className="pt-3 ps-1 pb-2">
        <h3 className="text-xl font-bold items-center inline-flex gap-2">
          Status Questions
          <Badge>Last 30 Days</Badge>
        </h3>
      </div>

      <div className="flex flex-wrap -mx-2">
        {statusQuestions.map(({ key, label, tooltip, Icon }) => (
          <div key={key} className="w-full sm:w-1/2 lg:w-1/4 px-2 mb-4">
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold inline-flex items-center justify-between gap-2 p-2">
                  {label}
                  <HelpTooltip>{tooltip}</HelpTooltip>
                </div>
                <div className="flex-shrink-0 ml-auto p-2">
                  <Icon
                    aria-hidden="true"
                    className="mr-2 h-6 w-6"
                    strokeWidth={1.75}
                  />
                </div>
              </div>

              {chartData?.self_reported_over_time && (
                <>
                  <div className="text-2m font-bold text-center">
                    {chartData.today[0]?.[`${key}_trend` as keyof TodayData]
                      ?.toString()
                      .toUpperCase()}{' '}
                    {chartData.today[0]?.[`${key}_mean` as keyof TodayData]}
                  </div>
                  <SparklineChart
                    keyName={key}
                    data={chartData.self_reported_over_time}
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
