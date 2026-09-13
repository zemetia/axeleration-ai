import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { Typography } from '@/components/ui/Typography';

import { RegisterForm } from './RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Create account', path: '/register', noIndex: true });
}

export default async function RegisterPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-16">
      <div className="elevation-lg border-border bg-surface w-full max-w-sm rounded-xl border p-8">
        <Typography variant="h3" className="mb-1 text-center">
          Create your account
        </Typography>
        <Typography variant="muted" className="mb-6 text-center">
          Start building AI-generated video series
        </Typography>
        <RegisterForm />
      </div>
    </main>
  );
}
