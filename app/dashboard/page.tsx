import { redirect } from 'next/navigation';
import { retrieveData } from '@/lib/data';
import { auth } from '@/lib/auth';

export default async function DefaultDashboardPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const data = await retrieveData(session.user?.name);
  if (!data) {
    redirect('/login');
  }

  const firstChartName = data.charts[0].id;
  redirect(`/dashboard/${firstChartName}`);
}
