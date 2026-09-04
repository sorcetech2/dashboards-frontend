import { requirePrincipal } from '@/lib/auth-guards';
import { retrieveDashboardData } from '@/lib/data';
import { DashboardResultState } from './components/dashboard-result-state';
import { DashboardState } from './components/dashboard-state';
import { DashboardView } from './components/dashboard-view';

export default async function DefaultDashboardPage() {
  const principal = await requirePrincipal();
  const result = await retrieveDashboardData(principal);

  if (result.status !== 'ok') {
    return <DashboardResultState status={result.status} />;
  }

  const firstChart = result.data.charts[0];
  if (!firstChart) {
    return (
      <DashboardState title="No team data yet">
        <p>
          Your account is ready, but no team dashboards have been generated.
        </p>
      </DashboardState>
    );
  }

  return (
    <DashboardView
      data={result.data}
      chartData={firstChart}
      isAdmin={principal.role === 'admin'}
    />
  );
}
