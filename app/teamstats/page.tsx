import * as React from 'react';
import Image from 'next/image';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { teamStats } from '@/lib/data';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/users';

import { MainNav } from '../dashboard/components/main-nav';

import { CompaniesContent } from './components/content';

export const metadata: Metadata = {
  title: 'Teamstats',
  description: ''
};

export default async function () {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }
  const admin = isAdmin(session.user.name);
  if (!admin) {
    redirect('/dashboard');
  }

  const data = await teamStats();

  return (
    <>
      <div className="min-h-screen flex flex-col md:flex">
        <div className="border-b">
          <div className="flex h-16 items-center px-4">
            <Image
              src="/logo.png"
              alt="SORCE"
              width={120}
              height={40}
              className="inline-block mr-2"
            />
            {/* {admin && <MainNav className="mx-6" />} */}
            <div className="ml-auto flex items-center space-x-4"></div>
          </div>
        </div>
        <CompaniesContent content={data} />
      </div>
    </>
  );
}
