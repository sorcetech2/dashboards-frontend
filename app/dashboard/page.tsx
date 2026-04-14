import { redirect } from 'next/navigation';
import Image from 'next/image';
import { retrieveData } from '@/lib/data';
import { auth } from '@/lib/auth';
import { SorceData } from '@/lib/sorce_data';

export default async function DefaultDashboardPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  console.log('session', session);


  let data: SorceData | null = null;
  try {
    data = await retrieveData(session.user?.name);
  } catch (error) {
    console.error('Error retrieving data:', error);
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
                  Empty Dashboard
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const firstChartName = data.charts[0].id;
  redirect(`/dashboard/${firstChartName}`);
}
