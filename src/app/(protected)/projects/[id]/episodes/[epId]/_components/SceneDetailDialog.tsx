'use client';

import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { MentionText } from '@/components/shared/MentionText';
import { Button } from '@/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { shotWindows } from '@/lib/scene-prompt';
import type { SceneSpec } from '@/lib/scene-spec';

/**
 * One beat, read rather than edited — what opens when a scene is clicked.
 *
 * The blocks are laid out as they are written, and an empty one is simply absent, exactly as it is
 * absent from the prompt: the panel should show what was decided, not a list of fields that were
 * skipped. The shots get the one piece of layout the plain prompt cannot give them — a time column
 * — because "where in the clip" is the question a shot list is read to answer.
 */
export interface SceneDetailDialogProps {
  /** Which project's roster the `@handle` mentions link into. */
  projectId: string;
  scene: SceneSpec;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The prompt that was actually sent, when this beat has been generated at least once. */
  prompt?: string | null;
  onEdit: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow">{label}</span>
      <div className="text-foreground text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** Rendered only when it has something to say — see the note on the component. */
function TextBlock({ label, text, projectId }: { label: string; text: string; projectId: string }) {
  if (!text.trim()) return null;
  return (
    <Block label={label}>
      <MentionText text={text} projectId={projectId} />
    </Block>
  );
}

export function SceneDetailDialog({
  projectId,
  scene,
  isOpen,
  onOpenChange,
  prompt,
  onEdit,
  onDelete,
  isDeleting,
}: SceneDetailDialogProps) {
  const windows = shotWindows(scene.shots);
  const shotCount = scene.shots.length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scene {scene.index}</DialogTitle>
          <DialogDescription>
            {scene.durationSeconds}s · {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
            {scene.dialogue.length > 0
              ? ` · ${scene.dialogue.length} spoken ${scene.dialogue.length === 1 ? 'line' : 'lines'}`
              : ' · no dialogue'}
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex flex-1 flex-col gap-4 overflow-y-auto pr-2">
          <TextBlock label="Style" text={scene.style} projectId={projectId} />
          <TextBlock label="Setting" text={scene.setting} projectId={projectId} />

          {shotCount > 0 ? (
            <Block label="Shots">
              <ol className="flex flex-col gap-2">
                {scene.shots.map((shot, position) => {
                  const window = windows[position];
                  // Dialogue reads under the shot it is spoken over, the way it is written in the
                  // editor — the prompt gathers it into one block instead, but a list of lines
                  // tagged "Shot 2" is a cross-reference to resolve, not something to read.
                  const spoken = scene.dialogue.filter(
                    (line) => Math.min(Math.max(line.shot, 1), shotCount) === position + 1,
                  );
                  return (
                    <li
                      key={position}
                      className="border-border bg-surface-raised flex gap-3 rounded-xl border p-3"
                    >
                      <span className="text-foreground-muted w-16 shrink-0 text-xs font-semibold tabular-nums">
                        {window?.startSeconds ?? 0}-{window?.endSeconds ?? 0}s
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {shot.camera.trim() ? (
                          <span className="text-foreground-muted text-xs">
                            <MentionText text={shot.camera} projectId={projectId} />
                          </span>
                        ) : null}
                        <span className="text-foreground text-sm leading-relaxed">
                          {shot.action.trim() ? (
                            <MentionText text={shot.action} projectId={projectId} />
                          ) : (
                            <span className="text-foreground-subtle">Nothing written yet.</span>
                          )}
                        </span>

                        {spoken.length > 0 ? (
                          <ul className="border-border mt-1.5 flex flex-col gap-1 border-l-2 pl-3">
                            {spoken.map((entry, line) => (
                              <li key={line} className="text-sm leading-relaxed">
                                <span className="text-foreground font-medium">
                                  {entry.speaker || 'Voice'}
                                </span>
                                {entry.delivery.trim() ? (
                                  <span className="text-foreground-muted italic">
                                    {' '}
                                    ({entry.delivery})
                                  </span>
                                ) : null}
                                <span className="text-foreground-muted">
                                  {': '}
                                  <MentionText text={entry.line} projectId={projectId} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Block>
          ) : null}

          <TextBlock label="Lighting" text={scene.lighting} projectId={projectId} />
          <TextBlock label="Audio" text={scene.audio} projectId={projectId} />
          <TextBlock label="Negative" text={scene.negative} projectId={projectId} />

          {prompt ? (
            <Collapsible className="border-border bg-surface-raised rounded-xl border">
              <CollapsibleTrigger className="group text-foreground-muted hover:text-foreground flex w-full items-center justify-between gap-2 px-3 py-2 text-xs transition-colors">
                Prompt actually sent
                <ChevronDown
                  className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-foreground-muted px-3 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {prompt}
                </p>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {onDelete ? (
            <Button
              variant="ghost"
              disabled={isDeleting}
              onClick={onDelete}
              className="hover:text-destructive-text"
            >
              <Trash2 aria-hidden="true" />
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onEdit}>
              <Pencil aria-hidden="true" />
              Edit beat
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
SceneDetailDialog.displayName = 'SceneDetailDialog';
