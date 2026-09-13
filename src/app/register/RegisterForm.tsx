'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

import { registerAction } from './actions';

const CODE_MESSAGES = {
  emailTaken: 'An account with this email already exists',
  createdSignIn: 'Account created — please sign in',
};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, {});

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          autoFocus
          aria-invalid={Boolean(state.errors?.['name']?.[0])}
        />
        {state.errors?.['name']?.[0] ? (
          <p className="text-destructive-text text-xs">{state.errors['name'][0]}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          aria-invalid={Boolean(state.errors?.['email']?.[0])}
        />
        {state.errors?.['email']?.[0] ? (
          <p className="text-destructive-text text-xs">{state.errors['email'][0]}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          aria-invalid={Boolean(state.errors?.['password']?.[0])}
        />
        {state.errors?.['password']?.[0] ? (
          <p className="text-destructive-text text-xs">{state.errors['password'][0]}</p>
        ) : (
          <p className="text-foreground-muted text-xs">At least 8 characters</p>
        )}
      </div>
      {state.code ? (
        <p className="text-destructive-text text-sm">{CODE_MESSAGES[state.code]}</p>
      ) : null}
      <Button type="submit" fullWidth disabled={isPending}>
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-foreground-muted text-center text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
RegisterForm.displayName = 'RegisterForm';
