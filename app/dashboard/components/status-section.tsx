'use client';

import type { Chart, TodayData } from '@/lib/sorce_data';
import { STATUS_QUESTION_FIELDS } from '@/lib/dashboard-data-contract';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from './top-card';
import { Brain, Heart, HeartPulse, Sparkles, UsersRound } from 'lucide-react';
import SparklineChart from './chart-sparkline';

interface StatusSectionProps {
  chartData: Chart | undefined;
}

const questionPresentation = {
  sleep: {
    tooltip: 'Answers to the question: How resourced does your body feel?',
    Icon: HeartPulse
  },
  nutrition: {
    tooltip: 'Answers to the question: How emotionally settled do you feel?',
    Icon: Heart
  },
  activity: {
    tooltip: 'Answers to the question: How clear does your mind feel?',
    Icon: Brain
  },
  resilience: {
    tooltip: 'Answers to the question: How connected do you feel to others?',
    Icon: UsersRound
  },
  productivity: {
    tooltip: 'Answers to the question: How inspired do you feel today?',
    Icon: Sparkles
  }
} as const;

export default function StatusSection({ chartData }: StatusSectionProps) {
  const today = chartData?.today?.[0];
  const statusData = chartData?.self_reported_over_time ?? [];
  const hasStatusData = statusData.length > 0;

  return (
    <>
      <div className="pt-3 ps-1 pb-2">
        <h3 className="text-xl font-bold items-center inline-flex gap-2">
          Status Questions
          <Badge>Last 30 Days</Badge>
        </h3>
      </div>

      <div className="flex flex-wrap -mx-2">
        {STATUS_QUESTION_FIELDS.map(({ key, label, meanKey, trendKey }) => {
          const { tooltip, Icon } = questionPresentation[key];
          return (
            <div key={key} className="mb-4 w-full px-2 sm:w-1/2 lg:w-1/5">
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

                {hasStatusData ? (
                  <>
                    <div className="text-center text-2xl font-bold">
                      {formatTrend(today?.[trendKey as keyof TodayData])}{' '}
                      {formatMean(today?.[meanKey as keyof TodayData])}
                    </div>
                    <SparklineChart keyName={key} data={statusData} />
                  </>
                ) : (
                  <p className="px-2 pb-4 text-center text-sm text-muted-foreground">
                    No data available
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function formatMean(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}` : '—';
}

function formatTrend(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.toUpperCase() : '—';
}
