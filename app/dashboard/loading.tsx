import { Skeleton } from '@/components/ui/skeleton';
import { DashboardState } from './components/dashboard-state';

export default function DashboardLoading() {
  return (
    <DashboardState title="Loading dashboard">
      <p>Your latest team data is loading.</p>
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full sm:col-span-2" />
      </div>
    </DashboardState>
  );
}
