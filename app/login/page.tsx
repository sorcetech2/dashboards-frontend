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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const usernameValue = formData.get('username');
    const passwordValue = formData.get('password');
    const submittedUsername =
      typeof usernameValue === 'string' ? usernameValue : '';
    const submittedPassword =
      typeof passwordValue === 'string' ? passwordValue : '';
    try {
      const result = await signIn('credentials', {
        username: submittedUsername,
        password: submittedPassword,
        redirect: false
      });
      if (!result?.ok || result.error) {
        setError('Invalid username or password.');
        setPending(false);
        return;
      }
      window.location.assign('/dashboard');
    } catch {
      setError('Invalid username or password.');
      setPending(false);
    }
  };

  return (
    <main
      id="main-content"
      className="min-h-screen flex justify-center items-start md:items-center p-8"
    >
      <NeonGradientCard className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            <Image
              src="/logo2.png"
              alt="SORCE"
              width={220}
              height={80}
              className="inline-block mr-2"
              priority
            />
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to log in.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="w-full space-y-4"
          >
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                maxLength={200}
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
                autoComplete="current-password"
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <p
              role={error ? 'alert' : 'status'}
              aria-live="polite"
              className="min-h-5 text-sm text-red-400"
            >
              {error}
            </p>
            <ShimmerButton
              type="submit"
              className="w-full shadow-2xl disabled:opacity-60"
              disabled={pending}
            >
              <span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg">
                {pending ? 'Signing in…' : 'Log in'}
              </span>
            </ShimmerButton>
          </form>
        </CardFooter>
      </NeonGradientCard>
    </main>
  );
}
