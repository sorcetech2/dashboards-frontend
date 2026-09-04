'use client';

import { CompanyStats, TeamStats } from '@/lib/sorce_data';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from './sidebar';
import { columns } from './table';
import { DataTable } from './table';
import RecordingsScatterPlot from './chart-time';
import { TopCard } from '../../dashboard/components/top-card';

export function CompaniesContent({ content }: { content: CompanyStats[] }) {
  const searchParams = useSearchParams();
  const selectedCompany = searchParams.get('company');

  const company = content.find((item) => item.company_name === selectedCompany);
  const stats: TeamStats[] = company?.stats ?? [];

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col md:flex-row md:overflow-hidden"
    >
      <div className="h-full w-full p-4 md:w-[250px] md:shrink-0">
        <Sidebar companyStats={content} selectedCompany={selectedCompany} />
      </div>
      <div className="min-w-0 flex-1 space-y-4 p-4 pt-2 md:p-8 md:pt-6">
        <div className="flex items-center justify-between">
          {company && selectedCompany ? (
            <h1 className="text-3xl font-bold tracking-tight">
              {selectedCompany}
            </h1>
          ) : (
            <h1 className="p-4 text-xl font-semibold text-muted-foreground">
              Select a company to view details
            </h1>
          )}
        </div>
        {company && <TeamsContent company={company} />}
        {company && (
          <TopCard
            title="Recordings over the last 10 days"
            help="All recordings from the latest 10-day period, distributed by date and time."
          >
            <RecordingsScatterPlot data={stats} />
          </TopCard>
        )}
      </div>
    </main>
  );
}

export function TeamsContent({ company }: { company: CompanyStats }) {
  const data = company.stats.map((team) => ({
    team_name: team.team_name,
    total_recordings_count: team.total_recordings_count,
    recent_recordings_count: team.recent_recordings.length,
    recent_active_members: team.recent_active_members,
    total_members: team.total_members
  }));
  return <DataTable columns={columns} data={data} />;
}
