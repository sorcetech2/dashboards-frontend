import type { DataResult } from '@/lib/data';
import type { SorceData } from '@/lib/sorce_data';
import { DashboardState } from './dashboard-state';

type DashboardFailureStatus = Exclude<DataResult<SorceData>['status'], 'ok'>;

export function DashboardResultState({
  status
}: {
  status: DashboardFailureStatus;
}) {
  const content = {
    notConfigured: {
      title: 'Dashboard not configured',
      message:
        'Your account is active, but its dashboard has not been configured.'
    },
    notGenerated: {
      title: 'Data is being prepared',
      message:
        'Your dashboard is configured, but no data has been generated yet.'
    },
    temporarilyUnavailable: {
      title: 'Dashboard temporarily unavailable',
      message:
        'We could not load the latest dashboard. Please try again shortly.'
    },
    invalidPayload: {
      title: 'Dashboard update needs attention',
      message: 'The latest dashboard data could not be read safely.'
    },
    forbidden: {
      title: 'Dashboard access unavailable',
      message:
        'This session no longer has access to a dashboard. Please sign in again.'
    }
  } satisfies Record<
    DashboardFailureStatus,
    { title: string; message: string }
  >;

  return (
    <DashboardState title={content[status].title}>
      <p>{content[status].message}</p>
    </DashboardState>
  );
}
