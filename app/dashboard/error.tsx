'use client';

import { Button } from '@/components/ui/button';
import { DashboardState } from './components/dashboard-state';

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <DashboardState
      title="Dashboard temporarily unavailable"
      action={
        <Button type="button" variant="outline" onClick={reset}>
          Try again
        </Button>
      }
    >
      <p>
        We couldn&apos;t load the latest dashboard data. Your account is still
        signed in; try again in a moment.
      </p>
    </DashboardState>
  );
}
