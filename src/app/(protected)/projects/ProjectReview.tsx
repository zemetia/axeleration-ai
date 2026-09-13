'use client';

import { Badge } from '@/components/ui/Badge';
import {
  ASPECT_RATIO_LABELS,
  PROJECT_TYPE_LABELS,
  RESEARCH_MODE_LABELS,
  RESOLUTION_LABELS,
} from '@/config/project-options';
import { estimateScenes } from '@/lib/scene-estimate';

import type { ProjectDraft } from './project-draft';

export interface ProjectReviewProps {
  value: ProjectDraft;
}

/** Read-only recap of the whole draft — the last wizard step before the project is created. */
export function ProjectReview({ value }: ProjectReviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-surface rounded-lg border p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="soft">{PROJECT_TYPE_LABELS[value.type]}</Badge>
          {value.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-foreground text-lg font-semibold">{value.name || 'Untitled project'}</p>
        {value.logline ? (
          <p className="text-foreground-muted mt-1 text-sm">{value.logline}</p>
        ) : null}
        <p className="text-foreground-muted mt-3 text-sm leading-relaxed whitespace-pre-line">
          {value.premise}
        </p>
      </div>

      <dl className="border-border grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border p-5 sm:grid-cols-4">
        <Item label="Audience" value={value.targetAudience || '—'} />
        <Item label="Tone" value={value.tone || '—'} />
        <Item label="Language" value={value.language} />
        <Item label="Research" value={RESEARCH_MODE_LABELS[value.defaultResearchMode]} />
        <Item label="Aspect ratio" value={ASPECT_RATIO_LABELS[value.aspectRatio]} />
        <Item label="Resolution" value={RESOLUTION_LABELS[value.resolution]} />
        <Item label="Episode length" value={`${value.targetTotalSeconds}s`} />
        <Item label="Scenes / episode" value={`~${estimateScenes(value)}`} />
      </dl>

      {value.visualStyle ? (
        <div className="border-border rounded-lg border p-5">
          <p className="text-foreground-subtle text-xs tracking-wide uppercase">Visual style</p>
          <p className="text-foreground-muted mt-1 text-sm leading-relaxed">{value.visualStyle}</p>
        </div>
      ) : null}

      <p className="text-foreground-subtle text-sm">
        The character bible starts generating as soon as the project is created.
      </p>
    </div>
  );
}
ProjectReview.displayName = 'ProjectReview';

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground-subtle text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
