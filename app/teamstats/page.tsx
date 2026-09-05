import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth-guards';
import { retrieveTeamStats } from '@/lib/data';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { DashboardState } from '../dashboard/components/dashboard-state';
import { CompaniesContent } from './components/content';

export const metadata: Metadata = {
  title: 'Team stats',
  description: 'SORCE company activity overview'
};

export default async function TeamStatsPage() {
  const principal = await requireAdmin();
  const result = await retrieveTeamStats(principal);

  if (result.status !== 'ok') {
    const message =
      result.status === 'notGenerated'
        ? 'No company statistics have been generated yet.'
        : result.status === 'notConfigured'
          ? 'Company statistics are not configured for this environment.'
          : result.status === 'invalidPayload'
            ? 'The latest company statistics could not be read safely.'
            : 'Company statistics are temporarily unavailable.';
    return (
      <DashboardState title="Team stats unavailable" isAdmin>
        <p>{message}</p>
      </DashboardState>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader isAdmin />
      <CompaniesContent content={result.data} />
    </div>
  );
}
