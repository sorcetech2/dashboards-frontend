import Image from 'next/image';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

// Shared responsive header used by all authenticated dashboard states.
// Keeps the logo, optional admin link, team switcher, and sign-out
// available on mobile and desktop alike.
export function DashboardHeader({
  children,
  isAdmin = false
}: {
  children?: React.ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <header className="border-b">
      <div className="flex min-h-16 flex-wrap items-center gap-2 px-4 py-2">
        <Image
          src="/logo2.png"
          alt="SORCE"
          width={110}
          height={37}
          className="mr-2 inline-block shrink-0"
          priority
        />
        <nav aria-label="Dashboard" className="flex items-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/teamstats"
                className="text-muted-foreground hover:text-foreground"
              >
                Team Stats
              </Link>
              <Link
                href="/admin/users"
                className="text-muted-foreground hover:text-foreground"
              >
                Users
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex min-w-0 max-w-full flex-1 items-center justify-end gap-2 sm:flex-initial sm:pr-2">
          {children}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
