import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePrincipal } from '@/lib/auth-guards';
import { retrieveDashboardData } from '@/lib/data';
import { DashboardResultState } from '../components/dashboard-result-state';
import { DashboardView } from '../components/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'SORCE team dashboard'
};

export default async function DashboardPage({
  params
}: {
  params: Promise<{ chartName: string }>;
}) {
  const principal = await requirePrincipal();
  const result = await retrieveDashboardData(principal);
  if (result.status !== 'ok') {
    return <DashboardResultState status={result.status} />;
  }

  const { chartName } = await params;
  let selectedChartId: string;
  try {
    selectedChartId = decodeURIComponent(chartName);
  } catch {
    notFound();
  }

  const chartData = result.data.charts.find(
    (chart) => chart.id === selectedChartId
  );
  if (!chartData) notFound();

  return (
    <DashboardView
      data={result.data}
      chartData={chartData}
      isAdmin={principal.role === 'admin'}
    />
  );
}
