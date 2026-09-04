import { DashboardLink, DashboardState } from './components/dashboard-state';

export default function DashboardNotFound() {
  return (
    <DashboardState
      title="Team not found"
      action={
        <DashboardLink href="/dashboard">Open your dashboard</DashboardLink>
      }
    >
      <p>
        This team is not part of your dashboard. Choose one of your available
        teams to continue.
      </p>
    </DashboardState>
  );
}
