'use client';

import { Clapperboard, Plus } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useProjects } from '@/hooks/queries';
import type { ProjectVO } from '@/types/value-objects';

import { ProjectCard } from './ProjectCard';

export interface DashboardContentProps {
  /** Server-rendered first payload — with it, the skeleton branch never runs on first load. */
  initialProjects?: ProjectVO[];
}

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3';

export function DashboardContent({ initialProjects }: DashboardContentProps) {
  const { data: projects, isLoading } = useProjects(initialProjects);

  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="No projects yet"
        description="A project holds one video series — its cast, its look, and every episode you generate from it."
        action={
          <Link href="/projects/new" className={buttonVariants({ variant: 'primary', size: 'md' })}>
            <Plus aria-hidden="true" />
            Create your first project
          </Link>
        }
      />
    );
  }

  return (
    <div className={GRID}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
DashboardContent.displayName = 'DashboardContent';
