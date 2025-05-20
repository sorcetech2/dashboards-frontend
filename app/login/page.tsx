'use client';
import Image from 'next/image';
import {
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { NeonGradientCard } from '@/components/neon-gradient-card';
import ShimmerButton from '@/components/shimmer-button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currentUsername = formData.get('username') as string;
    const currentPassword = formData.get('password') as string;

    console.log('Submitting form with username:', currentUsername, 'and password:', currentPassword);
    await signIn('credentials', {
      username: currentUsername,
      password: currentPassword,
      callbackUrl: '/dashboard'
    });
  };

  return (
    <div className="min-h-screen flex justify-center items-start md:items-center p-8">
      <NeonGradientCard className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            <Image
              src="/logo2.png"
              alt="SORCE"
              width={220}
              height={80}
              className="inline-block mr-2"
            />
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to log in.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <ShimmerButton type="submit" className="w-full shadow-2xl">
              <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg">
                Log in
              </span>
            </ShimmerButton>
            {/* <Button type="submit" className="w-full">
              Log in
            </Button> */}
          </form>
        </CardFooter>
      </NeonGradientCard>
    </div>
  );
}
