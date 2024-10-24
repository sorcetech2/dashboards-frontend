import { SorceData, ChartState, TodayData, Chart } from '@/lib/sorce_data';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { TopCard, HelpTooltip } from './top-card';
import dynamic from 'next/dynamic';

const SparklineChart = dynamic(() => import('./chart-sparkline'), {
  ssr: false
});

interface StatusSectionProps {
  chartData: Chart | undefined;
}

export default function StatusSection({ chartData }: StatusSectionProps) {
  const sparkTooltips: Record<string, string> = {
    sleep: 'Answers to the question: How would you rate your sleep last night?',
    nutrition:
      'Answers to the question: How would you rate your food choices yesterday?',
    resilience:
      'Answers to the question: How well did you manage stress yesterday?',
    productivity:
      'Answers to the question: How would you rate your productivity yesterday?',
    activity:
      'Answers to the question: How would you rate your activity level yesterday?'
  };

  return (
    <>
      <div className="pt-3 ps-1 pb-2">
        <h3 className="text-xl font-bold items-center inline-flex gap-2">
          Status Questions
          <Badge>Last 30 Days</Badge>
        </h3>
      </div>

      <div className="flex flex-wrap -mx-2">
        {['sleep', 'activity', 'resilience', 'productivity', 'nutrition'].map(
          (key) => (
            <div key={key} className="w-full sm:w-1/2 lg:w-1/4 px-2 mb-4">
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold inline-flex items-center justify-between gap-2 p-2">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    <HelpTooltip>{sparkTooltips[key]}</HelpTooltip>
                  </div>
                  <div className="flex-shrink-0 ml-auto p-2">
                    <Image
                      src={`/${key}.png`}
                      alt={key}
                      width={24}
                      height={24}
                      className="inline-block mr-2"
                    />
                  </div>
                </div>

                {chartData?.self_reported_over_time && (
                  <>
                    <div className="text-2m font-bold text-center">
                      {chartData.today[0]?.[`${key}_trend` as keyof TodayData]
                        ?.toString()
                        .toUpperCase()}
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
          )
        )}
      </div>
    </>
  );
}
