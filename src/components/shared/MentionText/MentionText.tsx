'use client';

import Link from 'next/link';

// Deep import, not the `@/assets` barrel: the barrel re-exports `resolver.ts`, which pulls
// `@/services` → prisma → `pg` into this client component's bundle (`Can't resolve 'dns'`).
// `mention.ts` is pure string work and safe in the browser.
import { splitMentions } from '@/assets/mention';
import { useAssets } from '@/hooks/queries';
import { cn } from '@/lib/cn';

export interface MentionTextProps {
  /** Prose that may contain `@handle` mentions — a scene description, a dialogue line. */
  text: string;
  /** Which project's roster the handles are resolved against. */
  projectId: string;
  className?: string;
}

/**
 * Renders prose with its `@handle` mentions turned into links to the asset they name.
 *
 * A handle is not decoration: it is the pipeline pinning that shot to a fixed look (see
 * `buildAssetRoster` and `scriptPrompt`). Reading a beat, the question is always "which @luna is
 * this" — and the answer used to be four clicks away in the asset library.
 *
 * Handles are resolved **case-sensitively**, the same way `validateMentions` and `assetResolver` do:
 * a handle that differs only in case does not resolve downstream either, so linking it here would
 * promise a match the generation will not honour. An unresolved handle stays plain text with a
 * dotted underline — the model inventing a handle is exactly what T16's validator exists to catch,
 * and rendering it as a live link would hide it.
 */
export function MentionText({ text, projectId, className }: MentionTextProps) {
  const { data } = useAssets(projectId);
  const byHandle = new Map((data ?? []).map((asset) => [asset.handle, asset]));

  return (
    <span className={className}>
      {splitMentions(text).map((segment, index) => {
        if (segment.kind === 'text') return segment.text;

        const asset = byHandle.get(segment.handle);
        if (!asset) {
          return (
            <span
              key={index}
              title="No asset in this project has this handle."
              className="text-foreground-muted underline decoration-dotted underline-offset-2"
            >
              {segment.text}
            </span>
          );
        }

        return (
          <Link
            key={index}
            href={`/projects/${projectId}/assets/${asset.id}`}
            title={`${asset.name} · ${asset.typeLabel}`}
            // `pointer-events-auto` and `relative`: a mention can sit inside a card whose whole
            // body is a click target laid over the text (see `ScriptPanel`), and the link has to
            // win that overlap rather than open the beat editor.
            className={cn(
              'text-primary-text pointer-events-auto relative rounded font-medium',
              'hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            )}
          >
            {segment.text}
          </Link>
        );
      })}
    </span>
  );
}
MentionText.displayName = 'MentionText';
