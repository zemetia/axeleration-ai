import { Plus, Users } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';
import type { AssetVO } from '@/types/value-objects';

import { accentOf } from './assets/asset-ui';

/**
 * The cast, on the page you actually plan an episode from.
 *
 * Assets used to be a secondary icon button in the header, so a first-time user reached "Generate
 * episode" without ever learning the library exists — and then read a generic, drifting cast as a
 * failure of the AI. What the roster feeds is `@handle` substitution in SCRIPT and scene
 * composition (`src/assets/roster.ts`), so the empty state here is a warning, not a placeholder.
 */

export interface CastSectionProps {
  projectId: string;
  assets: AssetVO[];
}

/** Enough to recognise the show at a glance; the library itself is one click away. */
const VISIBLE_ASSETS = 12;

export function CastSection({ projectId, assets }: CastSectionProps) {
  const shown = assets.slice(0, VISIBLE_ASSETS);
  const overflow = assets.length - shown.length;

  return (
    <section className="flex flex-col gap-3" aria-label="Cast and assets">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">Cast &amp; assets</h2>
          <p className="text-foreground-muted text-sm">
            Characters, locations and props the script can pin a shot to by <code>@handle</code> —
            this is what keeps a face or a place identical across every scene and every episode.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/assets`}
          className={buttonVariants({ variant: assets.length === 0 ? 'primary' : 'outline', size: 'md' })}
        >
          <Plus aria-hidden="true" />
          {assets.length === 0 ? 'Add your first asset' : 'Manage assets'}
        </Link>
      </div>

      {assets.length === 0 ? (
        // Warning tone on purpose: generating now works, it just produces a show with no memory of
        // what anyone looks like, and that is invisible until the clips come back.
        <div className="border-warning/25 bg-warning-subtle flex items-start gap-3 rounded-2xl border p-4">
          <Users className="text-warning-text mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-foreground-muted text-sm leading-relaxed">
            <span className="text-foreground font-medium">This project has no assets yet.</span> You
            can still generate an episode — but with nothing to reference, every scene invents its
            own cast and settings, so faces, wardrobe and locations will drift from shot to shot.
            Add the recurring ones first and the pipeline will reuse them everywhere.
          </p>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {shown.map((asset) => {
            const accent = accentOf(asset.type);
            const Icon = accent.icon;
            return (
              <li key={asset.id}>
                <Link
                  href={`/projects/${projectId}/assets/${asset.id}`}
                  title={`${asset.typeLabel} — ${asset.name}`}
                  className="border-border bg-surface hover:border-border-strong flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-2 transition-colors"
                >
                  <span
                    className={`${accent.surface} ${accent.text} flex size-5 items-center justify-center rounded-full`}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                  <span className="text-foreground text-xs font-medium">@{asset.handle}</span>
                  <span className="text-foreground-subtle max-w-32 truncate text-xs">
                    {asset.name}
                  </span>
                </Link>
              </li>
            );
          })}
          {overflow > 0 ? (
            <li>
              <Link
                href={`/projects/${projectId}/assets`}
                className="text-foreground-muted hover:text-foreground border-border bg-surface-raised flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              >
                +{overflow} more
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
CastSection.displayName = 'CastSection';
