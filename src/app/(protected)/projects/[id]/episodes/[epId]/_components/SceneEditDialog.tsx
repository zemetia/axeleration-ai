'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

import { SceneSpecForm, type SceneSpecDraft } from './SceneSpecForm';

/**
 * The beat editor as a modal — the one place a beat is written, whether it is being added from the
 * Script panel or rewritten from a card in the Scenes room.
 *
 * A modal rather than an inline editor because the form is the whole prompt: seven blocks, a shot
 * list and a live preview. Expanded inside a list it pushed every other beat off the screen, and
 * inside a card it fought the video player for the same column. Editing one beat is a task with a
 * beginning and an end, so it gets its own surface and its own Save.
 *
 * Presentational on purpose — the draft lives in the caller, which is also what holds the mutation
 * and decides what "saved" means for it.
 */
export interface SceneEditDialogProps {
  /** Which project's roster the preview's `@handle` mentions link into. */
  projectId: string;
  title: string;
  description?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  value: SceneSpecDraft;
  onChange: (draft: SceneSpecDraft) => void;
  /** Shown above the footer — a refused write, a handle that resolves to nothing. */
  error?: string | null;
  isPending: boolean;
  isConfirmDisabled?: boolean;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
}

export function SceneEditDialog({
  projectId,
  title,
  description,
  isOpen,
  onOpenChange,
  value,
  onChange,
  error,
  isPending,
  isConfirmDisabled,
  confirmLabel,
  pendingLabel,
  onConfirm,
}: SceneEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Wider than the default dialog and capped at the viewport: the form is long enough to
          scroll on any screen, and only the fields scroll so the header and Save stay reachable. */}
      <DialogContent className="max-h-[90vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          <SceneSpecForm projectId={projectId} value={value} onChange={onChange} />
        </div>

        {error ? <p className="text-destructive-text text-xs">{error}</p> : null}

        <DialogFooter>
          <Button variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button isLoading={isPending} disabled={isPending || isConfirmDisabled} onClick={onConfirm}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
SceneEditDialog.displayName = 'SceneEditDialog';
