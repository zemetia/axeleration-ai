import { Blocks, BookOpen, Database, Server, ShieldCheck, TestTube2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Typography } from '@/components/ui/Typography';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';

const STACK_ITEMS = [
  'Next.js 15',
  'React 19',
  'TypeScript',
  'Tailwind v4',
  'Zustand',
  'Storybook 8',
  'Vitest',
] as const;

/**
 * Bento grid — spans are hand-tuned so the 6 tiles tile a 4-col × 3-row
 * grid with no gaps: `lg` (2×2) + `wide` (2×1) + `wide` (2×1) fill the top,
 * two `sm` (1×1) plus another `wide` fill the bottom. See the `SPAN_CLASSES`
 * map below for the actual Tailwind classes.
 */
const FEATURES = [
  {
    key: 'components',
    badge: 'CVA + Tailwind',
    title: 'Strict Components',
    description:
      'Every component lives in its own directory with full TypeScript types, CVA variants, and Storybook stories.',
    icon: Blocks,
    span: 'lg',
  },
  {
    key: 'storybook',
    badge: 'Storybook 8',
    title: 'Storybook 8',
    description:
      'Develop and document components in isolation with a11y testing and auto-generated docs.',
    icon: BookOpen,
    span: 'wide',
  },
  {
    key: 'services',
    badge: 'Typed Fetch',
    title: 'Service Layer',
    description: 'A typed fetch client with error handling and request/response interceptors.',
    icon: Server,
    span: 'sm',
  },
  {
    key: 'testing',
    badge: 'Vitest + RTL',
    title: 'Vitest + RTL',
    description: 'Component tests with Testing Library. No Jest config headaches.',
    icon: TestTube2,
    span: 'sm',
  },
  {
    key: 'typescript',
    badge: 'Strict Mode',
    title: 'Strict TypeScript',
    description:
      'noUncheckedIndexedAccess, noImplicitReturns, consistent-type-imports and more. No escape hatches.',
    icon: ShieldCheck,
    span: 'wide',
  },
  {
    key: 'state',
    badge: 'Zustand',
    title: 'State Management',
    description:
      'Lightweight Zustand stores with persistence helpers — no boilerplate reducers or context wiring.',
    icon: Database,
    span: 'wide',
  },
] as const;

const SPAN_CLASSES: Record<(typeof FEATURES)[number]['span'], string> = {
  lg: 'lg:col-span-2 lg:row-span-2',
  wide: 'lg:col-span-2',
  sm: 'lg:col-span-1',
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="container-page relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-24 text-center">
          <Badge variant="soft" className="mb-6">
            Production-Ready Template
          </Badge>

          <Typography
            variant="h1"
            className="from-foreground to-foreground-muted mb-6 max-w-3xl bg-gradient-to-b bg-clip-text text-balance text-transparent"
            style={{ whiteSpace: 'pre-line' }}
          >
            {'Build fast.\nShip with confidence.'}
          </Typography>

          <Typography variant="lead" className="text-foreground-muted mb-10 max-w-xl">
            A strict Next.js 15 template with TypeScript, component-based architecture, Storybook,
            and a clean service layer. Everything you need, nothing you don&apos;t.
          </Typography>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className={buttonVariants({ size: 'lg' })}>
              Get Started
            </Link>
            {siteConfig.company.socialLinks.github ? (
              <a
                href={siteConfig.company.socialLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: 'lg', variant: 'outline' })}
              >
                View Source
              </a>
            ) : null}
          </div>

          {/* Ambient blobs — two hues so the wash doesn't read as one flat gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div className="bento-blob-primary absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
            <div className="bento-blob-teal absolute top-2/3 right-0 h-[420px] w-[420px] translate-x-1/3 rounded-full blur-3xl" />
          </div>
        </section>

        {/* Features — bento grid */}
        <section className="container-page relative py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div className="bento-blob-teal absolute top-0 -left-40 h-[500px] w-[500px] rounded-full blur-3xl" />
          </div>

          <div className="mb-12 text-center">
            <Typography variant="h2" className="mb-3">
              Everything included
            </Typography>
            <Typography variant="lead" className="text-foreground-muted">
              A foundation you&apos;ll actually want to build on
            </Typography>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[180px] lg:grid-cols-4">
            {FEATURES.map(({ key, badge, title, description, icon: Icon, span }) => (
              <Card
                key={key}
                className={`elevation-sm flex flex-col rounded-2xl transition-shadow hover:shadow-lg ${span === 'lg' ? 'border-gradient' : ''} ${SPAN_CLASSES[span]}`}
              >
                <CardHeader className="flex-1">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="bg-primary-subtle text-primary-text flex h-10 w-10 items-center justify-center rounded-xl">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <Badge variant="secondary">{badge}</Badge>
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="container-page pb-24">
          <Typography variant="h3" className="text-foreground-muted mb-8 text-center">
            The Stack
          </Typography>
          <div className="flex flex-wrap justify-center gap-3">
            {STACK_ITEMS.map((label) => (
              <span
                key={label}
                className="elevation-sm border-border bg-surface text-foreground-muted rounded-full border px-4 py-1.5 font-mono text-sm font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
