import type { Metadata } from 'next';

import { Typography } from '@/components/ui/Typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container-page py-16">
        <Typography variant="h1" className="mb-4">
          About This Template
        </Typography>
        <Typography variant="lead" className="mb-12 text-foreground-muted">
          A strict, opinionated starting point for production Next.js applications.
        </Typography>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <Typography variant="muted" className="font-mono text-xs leading-relaxed">
                {`src/
  app/          ← App Router pages
  components/
    ui/         ← Primitive components
    layout/     ← Header, Footer
    shared/     ← Cross-feature components
  hooks/        ← Custom React hooks
  i18n/         ← Routing + request config
  lib/          ← cn(), utils
  services/     ← API client + services
  stores/       ← Zustand stores
  types/        ← Shared TypeScript types`}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Component Convention</CardTitle>
            </CardHeader>
            <CardContent>
              <Typography variant="muted" className="font-mono text-xs leading-relaxed">
                {`ComponentName/
  ComponentName.tsx      ← Implementation
  ComponentName.stories  ← Storybook
  ComponentName.test     ← Vitest + RTL
  index.ts               ← Named re-export`}
              </Typography>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
