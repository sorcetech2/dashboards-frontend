'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  const enabledClasses =
    'text-sm font-medium transition-colors hover:text-primary';
  const disabledClasses =
    'text-sm font-medium text-muted-foreground transition-colors hover:text-primary';

  return (
    <nav
      className={cn('flex items-center space-x-4 lg:space-x-6', className)}
      {...props}
    >
      <Link
        href="/dashboard"
        className={pathname === '/dashboard' ? enabledClasses : disabledClasses}
      >
        Dashboards
      </Link>
      <Link
        href="/teamstats"
        className={pathname === '/teamstats' ? enabledClasses : disabledClasses}
      >
        Customers
      </Link>
    </nav>
  );
}
