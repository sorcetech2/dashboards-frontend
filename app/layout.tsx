import './globals.css';

import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Next.js App Router + NextAuth + Tailwind CSS',
  description:
    'A user admin dashboard configured with Next.js, Postgres, NextAuth, Tailwind CSS, TypeScript, and Prettier.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* <script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script> */}
        {/* <script>dayjs().format()</script> */}
        {/* <script src="/chart-script.js"></script> */}
        {/* <script src="https://cdn.jsdelivr.net/npm/apexcharts@3.54.0"></script> */}
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
