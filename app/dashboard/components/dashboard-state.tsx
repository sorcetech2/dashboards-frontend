import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardHeader } from './dashboard-header';

export function DashboardState({
  title,
  children,
  action,
  isAdmin = false
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader isAdmin={isAdmin} />
      <main
        id="main-content"
        className="flex flex-1 items-start justify-center p-4 pt-10 md:p-8 md:pt-16"
      >
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            {children}
            {action}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export function DashboardLink({
  href,
  children
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild variant="outline">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
