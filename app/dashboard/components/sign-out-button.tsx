'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: '/login' }).catch(() => {
          setPending(false);
        });
      }}
    >
      {pending ? 'Signing out…' : 'Sign Out'}
    </Button>
  );
}
