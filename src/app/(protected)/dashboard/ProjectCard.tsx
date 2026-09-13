'use client';

import { ArrowRight, Film, Layers, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PROJECT_TYPE_LABELS } from '@/config/project-options';
import type { ProjectVO } from '@/types/value-objects';

const TYPE_VARIANT: Record<ProjectVO['type'], 'soft' | 'secondary'> = {
  EPISODIC: 'soft',
  NON_CONTINUOUS: 'secondary',
};

/** Tags beyond this go into a "+N" chip so cards stay one line of metadata. */
const VISIBLE_TAGS = 3;

export interface ProjectCardProps {
  project: ProjectVO;
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    // `title` is deliberately absent: it would become the accessible name and the sr-only span
    // would then be announced a second time.
    <span className="flex items-center gap-1.5">
      <Icon className="text-foreground-subtle size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-foreground-muted" aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="group block h-full rounded-2xl">
      <Card isInteractive className="flex h-full flex-col">
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={TYPE_VARIANT[project.type]}>
                {PROJECT_TYPE_LABELS[project.type]}
              </Badge>
              {project.hasFewScenesWarning ? <Badge variant="warning">Few scenes</Badge> : null}
            </div>
            <ArrowRight
              className="text-foreground-subtle group-hover:text-primary-text size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-foreground text-base leading-snug font-semibold tracking-tight text-balance">
              {project.name}
            </h2>
            <p className="text-foreground-muted line-clamp-2 text-sm leading-relaxed">
              {project.logline || project.premise}
            </p>
          </div>

          {project.tags.length > 0 ? (
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
              {project.tags.slice(0, VISIBLE_TAGS).map((tag) => (
                <span
                  key={tag}
                  className="bg-surface-raised text-foreground-muted rounded-md px-1.5 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
              {project.tags.length > VISIBLE_TAGS ? (
                <span className="text-foreground-subtle text-xs">
                  +{project.tags.length - VISIBLE_TAGS}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-3 text-xs">
          <Stat
            icon={Film}
            value={`${project.episodeCount}`}
            label={`${project.episodeCount} episode${project.episodeCount === 1 ? '' : 's'}`}
          />
          <Stat
            icon={Users}
            value={`${project.assetCount}`}
            label={`${project.assetCount} asset${project.assetCount === 1 ? '' : 's'}`}
          />
          <Stat
            icon={Layers}
            value={`~${project.estimatedScenes}`}
            label={`about ${project.estimatedScenes} scenes per episode`}
          />
        </div>
      </Card>
    </Link>
  );
}
ProjectCard.displayName = 'ProjectCard';
