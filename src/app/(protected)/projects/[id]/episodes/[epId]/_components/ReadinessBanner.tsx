'use client';

import { KeyRound } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';
import { useEpisodeForecast } from '@/hooks/queries';
import { article } from '@/lib/provider-readiness';

export interface ReadinessBannerProps {
  projectId: string;
  episodeId: string;
}

/**
 * What this episode cannot do yet, and why — shown before anything is clicked.
 *
 * The pipeline used to answer this only by failing: a stage was approved, the node resolved a
 * provider, and `No API key configured for provider "wavespeed"` arrived minutes later on a FAILED
 * row after five attempts. A missing credential is knowable up front, so it is stated up front.
 *
 * Deliberately not a blocking dialog. Writing an idea and a script by hand needs no credential at
 * all, and those stages stay usable while the video key is still missing — the banner names what is
 * blocked, and `StagePanel` disables exactly those buttons.
 */
export function ReadinessBanner({ projectId, episodeId }: ReadinessBannerProps) {
  const { data: forecast } = useEpisodeForecast(episodeId);
  const readiness = forecast?.readiness;

  if (!readiness || readiness.isReady) return null;

  return (
    <section
      aria-label="Missing provider credentials"
      className="border-warning/35 bg-warning-subtle flex flex-col gap-3 rounded-2xl border p-5"
    >
      <div className="flex items-start gap-3">
        <KeyRound aria-hidden className="text-warning-text mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-sm font-medium">
            {readiness.missing.length === 1
              ? 'One part of this pipeline has no API key yet'
              : `${readiness.missing.length} parts of this pipeline have no API key yet`}
          </p>
          <p className="text-foreground-muted text-sm">
            You can still write and edit everything by hand. The stages below that need a provider
            are disabled until a key is saved.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 pl-7">
        {readiness.missing.map((entry) => (
          <li
            key={`${entry.provider}:${entry.capability}`}
            className="text-foreground-muted text-sm"
          >
            <span className="text-foreground font-medium">{entry.label}</span> needs{' '}
            {article(entry.provider)}{' '}
            <span className="text-foreground font-medium">{entry.provider}</span> key
            <span className="text-foreground-subtle"> ({entry.model})</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 pl-7">
        <Link href="/settings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Add an API key
        </Link>
        <Link
          href={`/projects/${projectId}/settings/ai-providers`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Change this project&rsquo;s providers
        </Link>
      </div>
    </section>
  );
}
ReadinessBanner.displayName = 'ReadinessBanner';
