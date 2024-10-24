import './globals.css';

import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'SORCE Dashboards',
  description: 'Updated version of the sorce dashboards'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
      </head>
      <body
        style={{ backgroundColor: 'rgba(4,16,33,1)' }}
        className="dark flex min-h-screen w-full flex-col"
      >
        {children}
      </body>
      <Analytics />
    </html>
  );
}
