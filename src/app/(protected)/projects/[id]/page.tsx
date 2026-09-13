import { Settings2 } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { buildMetadata } from '@/lib/seo';
import { prisma } from '@/lib/prisma';
import { assetService, episodeService } from '@/services';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { buttonVariants } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ASPECT_RATIO_LABELS,
  PROJECT_TYPE_LABELS,
  RESEARCH_MODE_LABELS,
  RESOLUTION_LABELS,
} from '@/config/project-options';

import { getProjectQuery } from '../queries';
import { CastSection } from './CastSection';
import { EpisodesSection } from './EpisodesSection';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({ title: 'Project', path: `/projects/${id}`, noIndex: true });
}

const BIBLE_STATUS_LABEL: Record<string, string> = {
  ready: 'Ready',
  generating: 'Generating…',
  failed: 'Failed',
};

const BIBLE_STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'soft'> = {
  ready: 'success',
  failed: 'destructive',
  generating: 'soft',
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  // Four independent reads — they used to run one after another, and the episode list was not
  // fetched here at all: the client mounted, hydrated, then asked for it. Ownership is enforced
  // by `getProjectQuery`; the others are scoped to the same id and are discarded below if it
  // returns null.
  const [project, bible, episodes, assets] = await Promise.all([
    getProjectQuery(id),
    prisma.characterBible.findUnique({ where: { projectId: id }, select: { status: true } }),
    episodeService.listByProject(id),
    assetService.list(id),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Projects', href: '/dashboard' }, { label: project.name }]} />

        <PageHeader
          eyebrow={PROJECT_TYPE_LABELS[project.type]}
          title={project.name}
          description={project.logline || project.premise}
          meta={
            <>
              {project.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              {bible ? (
                <Badge variant={BIBLE_STATUS_VARIANT[bible.status] ?? 'soft'}>
                  Character bible: {BIBLE_STATUS_LABEL[bible.status] ?? 'Generating…'}
                </Badge>
              ) : null}
            </>
          }
          // Assets moved out of the header into their own section below: as a header button they
          // read as a settings-ish detail, and a first-time user never opened them.
          actions={
            <Link
              href={`/projects/${id}/settings`}
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
              title="Project settings"
              aria-label="Project settings"
            >
              <Settings2 aria-hidden="true" />
            </Link>
          }
        />
      </div>

      {/* The production spec, read-only here — a reminder of what every episode will inherit,
          not a form. Editing lives one click away in settings. */}
      <section
        aria-label="Production spec"
        className="elevation-sm border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4"
      >
        <Stat label="Aspect ratio" value={ASPECT_RATIO_LABELS[project.aspectRatio]} />
        <Stat label="Resolution" value={RESOLUTION_LABELS[project.resolution]} />
        <Stat label="Target length" value={`${project.targetTotalSeconds}s`} />
        <Stat label="Scenes / episode" value={`~${project.estimatedScenes}`} />
        <Stat label="Audience" value={project.targetAudience || '—'} />
        <Stat label="Tone" value={project.tone || '—'} />
        <Stat label="Language" value={project.language} />
        <Stat label="Research" value={RESEARCH_MODE_LABELS[project.defaultResearchMode]} />
      </section>

      <CastSection projectId={id} assets={assets} />

      <EpisodesSection projectId={id} initialEpisodes={episodes} assetCount={assets.length} />
    </div>
  );
}

/* Cells sit on a 1px `bg-border` grid gap, so the dividers come from the parent rather than eight
   sets of conditional border classes. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface flex flex-col gap-1 px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p className="text-foreground truncate text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}
