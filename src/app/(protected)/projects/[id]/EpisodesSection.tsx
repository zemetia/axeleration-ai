'use client';

import { ChevronRight, Film, Plus, Users, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import { useEpisodes, useGenerateEpisode } from '@/hooks/queries';
import { StatusChip } from '@/components/shared/StatusChip';
import type { EpisodeVO } from '@/types/value-objects';
import type { ResearchMode } from '@prisma/client';

export interface EpisodesSectionProps {
  projectId: string;
  /** Server-rendered first payload — removes the fetch-after-hydrate round trip. */
  initialEpisodes?: EpisodeVO[];
  /** Drives the no-cast warning below. Zero means every scene will invent its own cast. */
  assetCount?: number;
}

const RESEARCH_MODES: ResearchMode[] = ['AI_CDP', 'AI_REASONING', 'HUMAN', 'SKIP'];
const RESEARCH_MODE_LABELS: Record<ResearchMode, string> = {
  HUMAN: 'Human notes',
  AI_REASONING: 'AI reasoning (no web access)',
  AI_CDP: 'AI web research',
  SKIP: 'Skip',
};

const currencyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export function EpisodesSection({
  projectId,
  initialEpisodes,
  assetCount = 0,
}: EpisodesSectionProps) {
  const { data: episodes, isLoading } = useEpisodes(projectId, initialEpisodes);
  const generateEpisode = useGenerateEpisode(projectId);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [researchMode, setResearchMode] = useState<ResearchMode>('AI_CDP');
  const [researchNotes, setResearchNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    generateEpisode.mutate(
      {
        title: title.trim() || undefined,
        researchMode,
        researchNotes: researchMode === 'HUMAN' ? researchNotes.trim() || undefined : undefined,
      },
      {
        // The action reports failures as a message rather than throwing, so success is only
        // success when the message is absent — see the same pattern in IdeaPanel/ScriptPanel.
        onSuccess: (result) => {
          if (result.message) {
            setError(result.message);
            return;
          }
          setShowForm(false);
          setTitle('');
          setResearchNotes('');
        },
      },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">Episodes</h2>
          <p className="text-foreground-muted text-sm">
            Each one runs the full pipeline: research, idea, script, scenes, production.
          </p>
        </div>
        {!showForm ? (
          <Button size="md" onClick={() => setShowForm(true)}>
            <Plus aria-hidden="true" />
            New episode
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="elevation-sm border-border bg-surface flex flex-col gap-4 rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-foreground text-sm font-semibold">New episode</h3>
              <p className="text-foreground-muted text-xs">
                Both fields are optional — leave them alone and the AI decides.
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Cancel"
              disabled={generateEpisode.isPending}
              onClick={() => setShowForm(false)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          {/* Said here rather than only on the cast section, because this is the click that spends
              money on clips of a cast the pipeline has no reference for. Never blocks the run. */}
          {assetCount === 0 ? (
            <div className="border-warning/25 bg-warning-subtle flex items-start gap-3 rounded-xl border p-3">
              <Users className="text-warning-text mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-foreground-muted text-xs leading-relaxed">
                No assets in this project yet — the scenes will invent their own characters and
                locations, and they will not stay consistent between shots.{' '}
                <Link
                  href={`/projects/${projectId}/assets`}
                  className="text-primary-text font-medium hover:underline"
                >
                  Add your cast first
                </Link>
                , or generate anyway and add them later.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInputField
              label="Episode title"
              hint="Leave blank to auto-title from the generated idea."
              placeholder="Untitled"
              value={title}
              onChange={setTitle}
            />
            <SelectField
              label="Research mode"
              options={RESEARCH_MODES.map((mode) => ({
                value: mode,
                label: RESEARCH_MODE_LABELS[mode],
              }))}
              value={researchMode}
              onChange={(e) => setResearchMode(e.target.value as ResearchMode)}
            />
          </div>

          {researchMode === 'HUMAN' ? (
            <TextAreaField
              label="Research notes"
              hint="Pasted context the IDEA stage will read directly — no AI call for this mode."
              value={researchNotes}
              onChange={setResearchNotes}
              rows={3}
            />
          ) : null}

          {error ? <p className="text-destructive-text text-xs">{error}</p> : null}

          <div className="border-border flex flex-wrap gap-2 border-t pt-4">
            <Button isLoading={generateEpisode.isPending} onClick={handleGenerate}>
              {generateEpisode.isPending ? 'Starting…' : 'Generate episode'}
            </Button>
            <Button
              variant="ghost"
              disabled={generateEpisode.isPending}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !episodes || episodes.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No episodes yet"
          description="Generate the first one to kick off the pipeline. You can steer every stage before anything is rendered."
          action={
            showForm ? undefined : (
              <Button onClick={() => setShowForm(true)}>
                <Plus aria-hidden="true" />
                Generate first episode
              </Button>
            )
          }
        />
      ) : (
        // A list of rows rather than a table: on a phone the four-column table needed a horizontal
        // scrollbar, and the row's only real job is "open this episode".
        <ul className="elevation-sm divide-border border-border bg-surface divide-y overflow-hidden rounded-2xl border">
          {episodes.map((episode) => (
            <li key={episode.id}>
              <Link
                href={`/projects/${projectId}/episodes/${episode.id}`}
                className="group hover:bg-surface-raised flex items-center gap-4 px-5 py-4 transition-colors"
              >
                <span className="bg-surface-raised text-foreground-muted group-hover:bg-primary-subtle group-hover:text-primary-text flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums">
                  {episode.number}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-foreground truncate text-sm font-medium">
                    {episode.title || `Episode ${episode.number}`}
                  </span>
                  <span className="text-foreground-subtle text-xs">
                    Updated {dateFormat.format(new Date(episode.updatedAt))}
                    {episode.totalCost === null
                      ? ''
                      : ` · ${currencyFormat.format(episode.totalCost)} spent`}
                  </span>
                </span>

                <StatusChip status={episode.status} className="hidden sm:inline-flex" />
                <ChevronRight
                  className="text-foreground-subtle size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
EpisodesSection.displayName = 'EpisodesSection';
