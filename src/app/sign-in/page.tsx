import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { Typography } from '@/components/ui/Typography';

import { SignInForm } from './SignInForm';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Sign in', path: '/sign-in', noIndex: true });
}

export default async function SignInPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-16">
      <div className="elevation-lg border-border bg-surface w-full max-w-sm rounded-xl border p-8">
        <Typography variant="h3" className="mb-1 text-center">
          Welcome back
        </Typography>
        <Typography variant="muted" className="mb-6 text-center">
          Sign in to your video projects
        </Typography>
        <SignInForm />
      </div>
    </main>
  );
}
