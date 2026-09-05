import './globals.css';

import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'SORCE Dashboards',
  description: 'Team health and wellbeing dashboards from SORCE'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{ backgroundColor: 'rgba(4,16,33,1)' }}
        className="dark flex min-h-screen w-full flex-col"
      >
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-background px-4 py-2 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
