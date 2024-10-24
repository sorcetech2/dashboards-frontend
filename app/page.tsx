'use client';
import Image from 'next/image';
import {
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

import { NeonGradientCard } from '@/components/neon-gradient-card';

export default function LogoutPage() {
  return (
    <div className="min-h-screen flex justify-center items-start md:items-center p-8">
      <NeonGradientCard className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            <Image
              src="/logo.png"
              alt="SORCE"
              width={220}
              height={80}
              className="inline-block mr-2"
            />
          </CardTitle>
          <CardDescription className="text-center">
            You're signed out.{' '}
            <a className="underline" href="/login">
              Log in
            </a>{' '}
            to continue.
          </CardDescription>
        </CardHeader>
        <CardFooter></CardFooter>
      </NeonGradientCard>
    </div>
  );
}
