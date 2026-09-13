'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

import { signInAction } from './actions';

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInAction, {});

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state.error ? (
        <p className="text-destructive-text text-sm">Invalid email or password</p>
      ) : null}
      <Button type="submit" fullWidth disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-foreground-muted text-center text-sm">
        No account yet?{' '}
        <Link href="/register" className="text-primary-text hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
SignInForm.displayName = 'SignInForm';
