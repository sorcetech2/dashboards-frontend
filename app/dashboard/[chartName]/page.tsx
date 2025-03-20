export const dynamicParams = true;

// export async function generateStaticParams() {
//   const session = await auth();
//   if (!session || !session.user) {
//     return [];
//   }

//   const data = await retrieveData(session.user?.name);
//   if (!data) {
//     return [];
//   }

//   return data.charts.map((chart) => ({
//     chartName: chart.name
//   }));
// }

import * as React from 'react';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { ChartState, SorceData } from '@/lib/sorce_data';
import { rmpColor } from '@/lib/utils';
import { retrieveData } from '@/lib/data';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/users';

import { TeamSwitcher, SwitchableTeam } from '../components/team-switcher';
import { TopCard } from '../components/top-card';
import { EngagementRate } from '../components/engagement-rate';
import { AverageHRV } from '../components/average-hrv';
import HexacoSection from '../components/hexaco-section';
import StatusSection from '../components/status-section';
import { MainNav } from '../components/main-nav';
import { Session } from 'next-auth';
const EnergyChart = dynamic(() => import('../components/chart-energy'), {
  ssr: false
});

export const metadata: Metadata = {
  title: 'Dashboard',
  description: ''
};

async function fetchDashboardData(chartId: string) {
  const session = await auth();
  if (!session || !session.user) {
    return null;
  }

  const data = await retrieveData(session.user?.name);
  if (!data) {
    return null;
  }

  const chartState: ChartState = {
    data: data,
    currentDate: new Date(),
    isLoading: false,
    fullDataChart: null,
    didFullData: false,
    selectedChart: chartId || data.charts[0].id,
    energyChart: null
  };

  const chartData = chartState.data?.charts.find(
    (chart) => chart.id === chartState.selectedChart
  );

  return { data, chartData, chartState };
}

export default async function DashboardPage({
  params
}: {
  params: { chartId: string };
}) {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const data = await retrieveData(session.user?.name);
  if (!data) {
    redirect('/login');
  }

  if (data === null) {
    return (
      <>
        <div className="hidden flex-col md:flex">
          <div className="border-b">
            <div className="flex h-16 items-center px-4">
              <Image
                src="/logo2.png"
                alt="SORCE"
                width={120}
                height={40}
                className="inline-block mr-2"
              />
              {/* {admin && <MainNav className="mx-6" />} */}
              <div className="ml-auto flex items-center space-x-4 pr-4">

              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
              <div className="flex items-center space-x-2">
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-2xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-gray-400">
                  You're logged in, but no data is available for you yet.
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  } else {
    return actualDashboard({ data, params, session });
  }
}

async function actualDashboard({
  data,
  params,
  session
}: {
  data: SorceData;
  params: { chartId: string };
  session: Session;
}) {
  const chartState: ChartState = {
    data: data,
    currentDate: new Date(),
    isLoading: false,
    fullDataChart: null,
    didFullData: false,
    selectedChart: params.chartId || data.charts[0].id,
    energyChart: null
  };

  const allCharts: SwitchableTeam[] = data.charts.map((c) => {
    return { name: c.name, value: c.id };
  });

  const chartData = chartState.data?.charts.find(
    (chart) => chart.id === chartState.selectedChart
  );

  const rmp = chartData?.today[0].rmp || 'No Data';
  const color = rmpColor(rmp);

  // const admin = isAdmin(session.user.name);

  return (
    <>
      <div className="hidden flex-col md:flex">
        <div className="border-b">
          <div className="flex h-16 items-center px-4">
            <Image
              src="/logo2.png"
              alt="SORCE"
              width={120}
              height={40}
              className="inline-block mr-2"
            />
            {/* {admin && <MainNav className="mx-6" />} */}
            <div className="ml-auto flex items-center space-x-4 pr-4">
              <TeamSwitcher teams={allCharts} />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-2xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-gray-400">
                {new Date().toLocaleDateString('en-EN')}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-1">
                <TopCard
                  title="Today's Energy Status"
                  help="If a person's HRV indicates a high degree of stress and lack of recovery they will get a RECOVER HRV score. If a person is somewhat recovered but not ready for higher intensity they get a MAINTAIN. If a person is fully recovered and ready to push the limits they will get a PUSH."
                >
                  <div className="text-xl font-bold items-center">
                    <svg width="24" height="24" className="inline-block mr-2">
                      <circle cx="10" cy="10" r="8" fill={color} />
                    </svg>
                    {rmp.charAt(0).toUpperCase() + rmp.slice(1).toLowerCase()}
                  </div>
                </TopCard>
              </div>

              <EngagementRate chartData={chartData} />
            </div>

            <AverageHRV chartData={chartData} />

            <div className="">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  {chartData && <EnergyChart data={chartData.main} />}
                </CardContent>
              </Card>
            </div>

            <StatusSection chartData={chartData} />

            <HexacoSection chartData={chartData} />
          </div>
        </div>
      </div>
    </>
  );
}
