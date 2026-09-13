'use client';

import { ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import {
  useEpisodeForecast,
  useEpisodeStages,
  useRunAdditionalResearch,
  useUpdateResearchDossier,
} from '@/hooks/queries';
import { blockedReason } from '@/lib/provider-readiness';
import type { EpisodeStageVO, ResearchDossierPatch } from '@/types/value-objects';
import type { ResearchMode } from '@prisma/client';

import { RunDialog } from './RunDialog';
import { StagePanel } from './StagePanel';

export interface ResearchPanelProps {
  episodeId: string;
}

const RESEARCH_MODE_LABELS: Record<ResearchMode, string> = {
  HUMAN: 'Human notes',
  AI_REASONING: 'AI reasoning — no web access',
  AI_CDP: 'AI web research',
  SKIP: 'Skipped',
};

interface ResearchSourceView {
  url: string;
  title?: string;
}

interface ResearchFindingView {
  claim: string;
  detail: string;
  sources: ResearchSourceView[];
}

/** A source row mid-edit — both fields are plain strings so a controlled input never goes uncontrolled. */
interface SourceDraft {
  url: string;
  title: string;
}

/** Reads the `ResearchDossier` the AI_CDP mode stores under `output.research` — absent in other modes. */
function findingsOf(output: Record<string, unknown> | null): ResearchFindingView[] {
  const research = output?.['research'];
  if (!research || typeof research !== 'object') return [];
  const findings = (research as { findings?: unknown }).findings;
  return Array.isArray(findings) ? findings.map(normalizeFinding) : [];
}

/**
 * Older/hand-merged dossier JSON can be missing `sources` entirely (it predates the schema's
 * `sources` default, or came from a manual DB edit) — normalize here so every downstream reader
 * can trust `finding.sources` is always an array instead of re-checking it everywhere.
 */
function normalizeFinding(finding: unknown): ResearchFindingView {
  const row = (finding ?? {}) as { claim?: unknown; detail?: unknown; sources?: unknown };
  return {
    claim: typeof row.claim === 'string' ? row.claim : '',
    detail: typeof row.detail === 'string' ? row.detail : '',
    sources: Array.isArray(row.sources) ? (row.sources as ResearchSourceView[]) : [],
  };
}

/** Rows with no URL are dropped — a title alone isn't a source, and `url` is validated as one. */
function trimSources(rows: SourceDraft[]): ResearchSourceView[] {
  return rows
    .map((row) => ({ url: row.url.trim(), title: row.title.trim() }))
    .filter((row) => row.url)
    .map((row) => (row.title ? row : { url: row.url }));
}

function trimFinding(draft: { claim: string; detail: string; sources: SourceDraft[] }): ResearchFindingView {
  return {
    claim: draft.claim.trim(),
    detail: draft.detail.trim(),
    sources: trimSources(draft.sources),
  };
}

/** Falls back to a single blank row so an editor always opens with something to fill in. */
function sourcesToDraft(sources: ResearchSourceView[]): SourceDraft[] {
  return sources.length
    ? sources.map((source) => ({ url: source.url, title: source.title ?? '' }))
    : [{ url: '', title: '' }];
}

/** Repeatable title+URL rows shared by the add-finding dialog and the inline finding editor. */
function SourceRowsEditor({
  sources,
  onChange,
}: {
  sources: SourceDraft[];
  onChange: (sources: SourceDraft[]) => void;
}) {
  function updateRow(index: number, patch: Partial<SourceDraft>) {
    onChange(sources.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-foreground-muted text-xs font-medium">Sources</span>
      {sources.map((row, index) => (
        <div
          key={index}
          className="border-border bg-surface-raised flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
        >
          <div className="flex flex-1 flex-col gap-2">
            <TextInputField
              label="Source title"
              value={row.title}
              onChange={(value) => updateRow(index, { title: value })}
              placeholder="Optional"
            />
            <TextInputField
              label="Source URL"
              value={row.url}
              onChange={(value) => updateRow(index, { url: value })}
              placeholder="https://…"
            />
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove source"
            className="hover:text-destructive-text shrink-0"
            onClick={() => onChange(sources.filter((_row, i) => i !== index))}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => onChange([...sources, { url: '', title: '' }])}
      >
        <Plus aria-hidden="true" />
        Add source
      </Button>
    </div>
  );
}

function FindingSources({ sources }: { sources: ResearchSourceView[] }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {sources.map((source, index) => (
        <li key={index}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary-text inline-flex w-fit max-w-full items-center gap-1 text-xs hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{source.title || source.url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function SummaryCard({
  episodeId,
  mode,
  summary,
  findingCount,
}: {
  episodeId: string;
  mode: string | null;
  summary: string;
  findingCount: number;
}) {
  const updateResearch = useUpdateResearchDossier(episodeId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(summary);

  function save() {
    updateResearch.mutate({ summary: draft }, { onSuccess: () => setIsEditing(false) });
  }

  return (
    <Card className="sm:col-span-2 lg:col-span-3">
      <CardHeader className="flex-row items-start justify-between gap-2 p-5 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Summary</CardTitle>
          <span className="text-eyebrow">
            {mode ? (RESEARCH_MODE_LABELS[mode as ResearchMode] ?? mode) : 'No mode recorded'}
            {findingCount > 0 ? ` · ${findingCount} findings` : ''}
          </span>
        </div>
        {!isEditing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(summary);
              setIsEditing(true);
            }}
          >
            <Pencil aria-hidden="true" />
            {summary ? 'Edit' : 'Write notes'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <TextAreaField
              value={draft}
              onChange={setDraft}
              rows={4}
              placeholder="What should the idea be grounded in?"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={updateResearch.isPending} onClick={save}>
                {updateResearch.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={updateResearch.isPending}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : summary ? (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{summary}</p>
        ) : (
          <p className="text-foreground-subtle text-sm">
            No research context — the idea is written from the premise alone.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Delete opens a dialog owned by the panel: removing a finding shifts the ones after it up a
 * position, and a card keyed by position is then reused for a *different* finding — per-card
 * confirm state would survive that shift and delete the wrong one.
 */
function FindingCard({
  episodeId,
  finding,
  position,
  allFindings,
  onRequestDelete,
}: {
  episodeId: string;
  finding: ResearchFindingView;
  position: number;
  allFindings: ResearchFindingView[];
  onRequestDelete: (position: number) => void;
}) {
  const updateResearch = useUpdateResearchDossier(episodeId);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [claim, setClaim] = useState(finding.claim);
  const [detail, setDetail] = useState(finding.detail);
  const [sources, setSources] = useState<SourceDraft[]>(() => sourcesToDraft(finding.sources));

  function startEditing() {
    setClaim(finding.claim);
    setDetail(finding.detail);
    setSources(sourcesToDraft(finding.sources));
    setIsEditing(true);
  }

  function save() {
    const findings = allFindings.map((row, index) =>
      index === position ? trimFinding({ claim, detail, sources }) : row,
    );
    const patch: ResearchDossierPatch = { findings };
    updateResearch.mutate(patch, { onSuccess: () => setIsEditing(false) });
  }

  return (
    <Card className="group" isInteractive={!isEditing}>
      <CardHeader className="flex-row items-center justify-between gap-2 p-5 pb-2">
        <CardTitle className="text-eyebrow">Finding {position + 1}</CardTitle>
        {!isEditing ? (
          <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit finding"
              onClick={(event) => {
                event.stopPropagation();
                startEditing();
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete finding"
              className="hover:text-destructive-text"
              disabled={updateResearch.isPending}
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete(position);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </CardHeader>
      {isEditing ? (
        <CardContent className="flex flex-col gap-2 p-5 pt-0">
          <div className="flex flex-col gap-2">
            <TextAreaField label="Claim" value={claim} onChange={setClaim} rows={2} />
            <TextAreaField label="Detail" value={detail} onChange={setDetail} rows={3} />
            <SourceRowsEditor sources={sources} onChange={setSources} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={updateResearch.isPending} onClick={save}>
                {updateResearch.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={updateResearch.isPending}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent
          className="focus-visible:ring-primary/25 flex cursor-pointer flex-col gap-2 rounded-lg p-5 pt-0 outline-none focus-visible:ring-4"
          role="button"
          tabIndex={0}
          onClick={() => setIsViewOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsViewOpen(true);
            }
          }}
        >
          <span className="text-foreground text-sm leading-snug font-medium">
            {finding.claim}
          </span>
          <span className="text-foreground-muted text-xs leading-relaxed">{finding.detail}</span>
          <FindingSources sources={finding.sources} />
        </CardContent>
      )}

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{finding.claim || `Finding ${position + 1}`}</DialogTitle>
            <DialogDescription>
              {finding.sources.length
                ? `${finding.sources.length} source${finding.sources.length === 1 ? '' : 's'}`
                : 'No sources attached'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
              {finding.detail || 'No further detail.'}
            </p>
            <FindingSources sources={finding.sources} />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="hover:text-destructive-text sm:mr-auto"
              disabled={updateResearch.isPending}
              onClick={() => {
                setIsViewOpen(false);
                onRequestDelete(position);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsViewOpen(false);
                startEditing();
              }}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Collapsed it is a dashed tile; expanded it is the same four fields `FindingCard` edits. */
function AddFindingCard({
  episodeId,
  allFindings,
}: {
  episodeId: string;
  allFindings: ResearchFindingView[];
}) {
  const updateResearch = useUpdateResearchDossier(episodeId);
  const [isOpen, setIsOpen] = useState(false);
  const [claim, setClaim] = useState('');
  const [detail, setDetail] = useState('');
  const [sources, setSources] = useState<SourceDraft[]>([{ url: '', title: '' }]);

  function reset() {
    setClaim('');
    setDetail('');
    setSources([{ url: '', title: '' }]);
  }

  function close() {
    reset();
    setIsOpen(false);
  }

  function save() {
    const findings = [...allFindings, trimFinding({ claim, detail, sources })];
    updateResearch.mutate({ findings }, { onSuccess: () => close() });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="border-border bg-surface-raised text-foreground-muted hover:border-primary/40 hover:bg-primary-subtle hover:text-primary-text flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-medium transition-colors"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add finding
      </button>

      <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (updateResearch.isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>New finding</DialogTitle>
            <DialogDescription>
              One concrete, checkable claim, grounded in as many sources as back it up.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
            <TextAreaField
              label="Claim"
              value={claim}
              onChange={setClaim}
              rows={2}
              placeholder="One concrete, checkable fact"
            />
            <TextAreaField
              label="Detail"
              value={detail}
              onChange={setDetail}
              rows={3}
              placeholder="Numbers, names, colors — whatever grounds it"
            />
            <SourceRowsEditor sources={sources} onChange={setSources} />
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={updateResearch.isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={updateResearch.isPending || !claim.trim()}
              isLoading={updateResearch.isPending}
              onClick={save}
            >
              {updateResearch.isPending ? 'Adding…' : 'Add finding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The one place the internal research agent is started on demand. It never replaces what is
 * already there — the agent is baselined against the existing dossier (same "already known, do not
 * repeat" baseline `researchNode` uses) and whatever it finds is appended, so this is safe to run
 * again and again as the episode's needs narrow. Works from an empty dossier too: a PENDING stage
 * just baselines against nothing.
 *
 * Rendered as a sibling of `StagePanel`, not inside its `children` render prop: that prop is only
 * called for PENDING/READY/APPROVED (see `StagePanel`'s GENERATING/FAILED branches), so a FAILED
 * research run — the one time a retry is most needed — would otherwise leave this bar unmounted
 * and the stage with no path forward at all, same failure shape as the RunDialog placement bug in
 * `docs/knowledge/LEARN.md` (2026-08-07). This bar owns its own GENERATING check instead.
 */
function AdditionalResearchBar({ episodeId }: { episodeId: string }) {
  const runResearch = useRunAdditionalResearch(episodeId);
  const { data: stages } = useEpisodeStages(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stage = stages?.find((row) => row.kind === 'RESEARCH');
  const isGenerating = stage?.status === 'GENERATING';
  const blocked = blockedReason(forecast?.readiness.stages['RESEARCH']);

  function run() {
    const trimmed = query.trim();
    if (!trimmed || runResearch.isPending) return;
    runResearch.mutate(trimmed, {
      onSuccess: (result) => {
        setError(result.message ?? null);
        if (!result.message) setQuery('');
      },
    });
  }

  return (
    <Card>
      <CardHeader className="p-5 pb-2">
        <CardTitle>Research more</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-5 pt-0">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <TextInputField
              label="What else should it find?"
              value={query}
              onChange={setQuery}
              placeholder={'e.g. "pricing for competing tools"'}
              onKeyDown={(event) => {
                if (event.key === 'Enter') run();
              }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            isLoading={runResearch.isPending}
            disabled={runResearch.isPending || !query.trim() || Boolean(blocked) || isGenerating}
            title={blocked ?? (isGenerating ? 'Research is already running' : undefined)}
            onClick={run}
          >
            {runResearch.isPending ? null : <Search aria-hidden="true" />}
            {runResearch.isPending ? 'Researching…' : 'Research'}
          </Button>
        </div>
        {stage?.status === 'FAILED' ? (
          <p className="text-destructive-text text-xs">
            The last run failed (see below) — search again to retry.
          </p>
        ) : null}
        {isGenerating ? (
          <p className="text-foreground-subtle text-xs">Research is already running…</p>
        ) : null}
        {blocked ? (
          <p className="text-warning-text text-xs">
            {blocked}{' '}
            <Link href="/settings" className="underline underline-offset-2">
              Add a key
            </Link>
          </p>
        ) : null}
        {error ? <p className="text-destructive-text text-xs">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Research feeds the idea and the idea becomes the script — one board, not a wizard. Summary and
 * findings render as their own editable cards in a wrapping grid so the layout adapts to however
 * much content a mode actually produced, instead of forcing a fixed vertical read order. Every card
 * is writable by hand: a stage the AI never filled in is authored here from an empty grid.
 */
export function ResearchPanel({ episodeId }: ResearchPanelProps) {
  const updateResearch = useUpdateResearchDossier(episodeId);
  const [deletingPosition, setDeletingPosition] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <AdditionalResearchBar episodeId={episodeId} />

      <StagePanel episodeId={episodeId} kind="RESEARCH" hideRegenerate>
        {(stage: EpisodeStageVO) => {
          const mode =
            typeof stage.output?.['mode'] === 'string' ? (stage.output['mode'] as string) : null;
          const summary =
            typeof stage.output?.['summary'] === 'string' ? stage.output['summary'] : '';
          const findings = findingsOf(stage.output);

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                episodeId={episodeId}
                mode={mode}
                summary={summary}
                findingCount={findings.length}
              />
              {findings.map((finding, position) => (
                <FindingCard
                  key={position}
                  episodeId={episodeId}
                  finding={finding}
                  position={position}
                  allFindings={findings}
                  onRequestDelete={setDeletingPosition}
                />
              ))}
              <AddFindingCard episodeId={episodeId} allFindings={findings} />

              <RunDialog
                isOpen={deletingPosition !== null}
                onOpenChange={(open) => setDeletingPosition(open ? deletingPosition : null)}
                title={`Delete finding ${deletingPosition === null ? '' : deletingPosition + 1}?`}
                description="Removes this finding from the dossier. The idea will no longer be grounded in it."
                confirmLabel="Delete finding"
                pendingLabel="Deleting…"
                isPending={updateResearch.isPending}
                isDanger
                onConfirm={() => {
                  if (deletingPosition === null) return;
                  updateResearch.mutate(
                    { findings: findings.filter((_row, index) => index !== deletingPosition) },
                    { onSettled: () => setDeletingPosition(null) },
                  );
                }}
              />
            </div>
          );
        }}
      </StagePanel>
    </div>
  );
}
ResearchPanel.displayName = 'ResearchPanel';
