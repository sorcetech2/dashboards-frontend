'use client';

import { CompanyStats, TeamStats } from '@/lib/sorce_data';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Team, columns } from './table';
import { DataTable } from './table';
import RecordingsScatterPlot from './chart-time';
import { TopCard, HelpTooltip } from '../../dashboard/components/top-card';

export function CompaniesContent({ content }: { content: CompanyStats[] }) {
  const searchParams = useSearchParams();
  const selectedCompany = searchParams.get('company');

  const company = content.find((c) => c.company_name == selectedCompany);
  var stats: TeamStats[] = [];
  company?.stats.forEach((stat) => {
    stats.push(stat);
  });

  return (
    <main className="flex flex-1 overflow-hidden">
      <div className="w-[250px] p-4 h-full">
        <Sidebar companyStats={content} selectedCompany={selectedCompany} />
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          {company && selectedCompany ? (
            <h2 className="text-3xl font-bold tracking-tight">
              {selectedCompany}
            </h2>
          ) : (
            <p className="text-muted-foreground p-4">
              Select a company to view details
            </p>
          )}
        </div>
        {company && <TeamsContent company={company} />}
        <TopCard
          title="Recordings over days (last 10 days)"
          help="All recordings from the past 10 days distributed by day / time"
        >
          {company && <RecordingsScatterPlot data={stats} />}
        </TopCard>
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
