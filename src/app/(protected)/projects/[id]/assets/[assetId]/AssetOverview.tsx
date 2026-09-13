'use client';

import { Check, Copy, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';

import { buildAssetProfile } from '@/assets/profile';
import { composeShotPrompt } from '@/assets/lab/compose';
import { Badge } from '@/components/ui/Badge';
import { assetSchemaOf } from '@/config/asset-schema';
import { anchorViewOf, viewOf } from '@/config/asset-views';
import { cn } from '@/lib/cn';
import type { AssetVO } from '@/types/value-objects';

import { accentOf } from '../asset-ui';
import { CopyButton } from '../CopyButton';

export interface AssetOverviewProps {
  asset: AssetVO;
  /** STYLE assets in this project — the inherited one is folded into the previewed prompt. */
  styleAssets?: AssetVO[];
}

/**
 * Everything the asset carries, in one read.
 *
 * Deliberately shows *empty* fields too, marked "Not set", rather than only the filled ones the
 * grid card and the old slide-over showed. What is missing is the actionable half: a field left
 * blank is a detail the model will invent, and the reader can only fix what they can see is absent.
 *
 * This pane always renders the **saved** asset. Edits live in the other two panes and are announced
 * as unsaved there — showing a draft here would make "what is this asset" and "what am I about to
 * make it" the same screen, which is exactly how a half-finished edit gets mistaken for the truth.
 */
export function AssetOverview({ asset, styleAssets = [] }: AssetOverviewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const schema = assetSchemaOf(asset.type);
  const accent = accentOf(asset.type);
  const Icon = accent.icon;
  const isVoice = asset.type === 'VOICE';
  const shots = asset.lab?.shots ?? [];

  // Composed from the saved asset, exactly as the lab would compose it — same function, same
  // inputs — so what is copied here is what the lab renders, not a lookalike written twice.
  const anchorPrompt = useMemo(() => {
    const view = anchorViewOf(asset.type);
    if (!view) return null;
    const style = styleAssets.find((entry) => entry.handle === asset.lab?.styleHandle);
    return composeShotPrompt({
      type: asset.type,
      name: asset.name,
      description: asset.description ?? undefined,
      attributes: asset.attributes,
      view,
      basePrompt: asset.lab?.basePrompt,
      styleText: style ? buildAssetProfile(style) : undefined,
    });
  }, [asset, styleAssets]);

  async function copyHandle() {
    await navigator.clipboard.writeText(`@${asset.handle}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className={cn('border-border overflow-hidden rounded-xl border', accent.surface)}>
          {asset.refUrl && !isVoice ? (
            // Local storage serves arbitrary user uploads through /media — next/image would need
            // every future host allow-listed, so a plain img is deliberate.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.refUrl} alt={asset.name} className="max-h-[28rem] w-full object-contain" />
          ) : asset.refUrl ? (
            <div className="flex flex-col gap-3 p-6">
              <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
                Reference audio
              </p>
              <audio controls src={asset.refUrl} className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <Icon aria-hidden className={cn('size-8', accent.text)} strokeWidth={1.25} />
              <p className="text-foreground-muted text-sm">
                No reference {schema.reference.kind === 'audio' ? 'audio' : 'image'} yet
              </p>
              <p className="text-foreground-subtle max-w-sm text-xs">{schema.reference.hint}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyHandle()}
            className="border-border bg-surface text-primary-text hover:border-border-strong focus-visible:ring-ring inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            @{asset.handle}
            {isCopied ? (
              <Check aria-hidden className="text-success size-3.5" />
            ) : (
              <Copy aria-hidden className="text-foreground-subtle size-3.5" />
            )}
          </button>
          <span className="text-foreground-subtle text-xs">
            {isCopied
              ? 'Copied — paste into any prompt, script beat or scene description'
              : 'Click to copy the mention token'}
          </span>
        </div>
      </section>

      <Block
        title="Description"
        description="Injected verbatim as the lead sentence of every prompt that mentions this handle."
      >
        {asset.description ? (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {asset.description}
          </p>
        ) : (
          <Absent>No description — prompts will lead with the name alone.</Absent>
        )}
      </Block>

      {anchorPrompt ? (
        <Block
          title={`Anchor prompt · ${anchorViewOf(asset.type)?.label}`}
          description="The exact text the lab sends for the identity sheet — every filled field, in order. Copy it to render the same asset in another tool."
        >
          <div className="flex flex-col gap-3">
            <PromptBox label="Prompt" value={anchorPrompt.prompt} />
            {anchorPrompt.negativePrompt ? (
              <PromptBox label="Negative prompt" value={anchorPrompt.negativePrompt} />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                label="Copy prompt + negative"
                value={
                  anchorPrompt.negativePrompt
                    ? `${anchorPrompt.prompt}\n\nNegative: ${anchorPrompt.negativePrompt}`
                    : anchorPrompt.prompt
                }
              />
              <span className="text-foreground-subtle text-xs">
                Regenerated from the saved fields — edit a field and this follows.
              </span>
            </div>
          </div>
        </Block>
      ) : null}

      {isVoice ? (
        <Block title="Provider voice" description="What the text-to-speech stage calls with.">
          {asset.voiceId ? (
            <p className="text-foreground font-mono text-sm">{asset.voiceId}</p>
          ) : (
            <Absent>No voice id — the render stage cannot speak as this asset yet.</Absent>
          )}
        </Block>
      ) : null}

      {schema.sections.map((section) => (
        <Block key={section.id} title={section.title} description={section.description}>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const value = asset.attributes[field.key];
              const isFilled = Array.isArray(value) ? value.length > 0 : Boolean(value);
              return (
                <div
                  key={field.key}
                  className={cn('flex flex-col gap-1', field.kind === 'textarea' && 'sm:col-span-2')}
                >
                  <dt className="text-foreground-subtle text-xs font-medium tracking-wide uppercase">
                    {field.label}
                  </dt>
                  <dd className="text-foreground text-sm">
                    {!isFilled ? (
                      <span className="text-foreground-subtle italic">Not set</span>
                    ) : Array.isArray(value) ? (
                      <span className="flex flex-wrap gap-1.5">
                        {value.map((item) => (
                          <span
                            key={item}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-xs font-medium',
                              accent.surface,
                              accent.text,
                            )}
                          >
                            {item}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="leading-relaxed whitespace-pre-wrap">{value}</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Block>
      ))}

      <Block
        title="Lab record"
        description="What the asset was built from — kept so it can be re-rendered later without starting over."
      >
        {asset.lab?.basePrompt || asset.lab?.styleHandle ? (
          <div className="flex flex-col gap-3">
            {asset.lab.basePrompt ? (
              <div className="flex flex-col gap-1">
                <span className="text-foreground-subtle text-xs font-medium tracking-wide uppercase">
                  Base prompt
                </span>
                <p className="border-border bg-surface-raised text-foreground-muted rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {asset.lab.basePrompt}
                </p>
              </div>
            ) : null}
            {asset.lab.styleHandle ? (
              <div className="flex items-center gap-2">
                <span className="text-foreground-subtle text-xs font-medium tracking-wide uppercase">
                  Inherited style
                </span>
                <Badge variant="soft">@{asset.lab.styleHandle}</Badge>
              </div>
            ) : null}
          </div>
        ) : (
          <Absent>
            This asset was written by hand — there is no base prompt behind it. Open the Lab pane to
            render one.
          </Absent>
        )}
      </Block>

      <Block
        title={`View sheet · ${shots.length} rendered`}
        description="Every angle the lab produced. The one used as this asset's reference is marked."
      >
        {shots.length === 0 ? (
          <Absent>
            Nothing rendered yet. The Lab pane renders the angles this type needs and turns one of
            them into the reference every later scene is generated against.
          </Absent>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shots.map((shot) => {
              const view = viewOf(asset.type, shot.viewId);
              const isReference = shot.url === asset.refUrl;
              return (
                <figure
                  key={`${shot.viewId}-${shot.createdAt}`}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-lg border',
                    isReference ? 'border-primary' : 'border-border',
                  )}
                >
                  <a
                    href={shot.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group focus-visible:ring-ring relative block focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {/* Local storage serves arbitrary user uploads through /media — see AssetCard. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shot.url}
                      alt={shot.label}
                      className="aspect-square w-full object-cover"
                    />
                    <span className="bg-surface/90 text-foreground-muted absolute right-1.5 bottom-1.5 rounded-full p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      <ExternalLink aria-hidden className="size-3" />
                    </span>
                    {isReference ? (
                      <span className="bg-primary text-primary-foreground absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold">
                        Reference
                      </span>
                    ) : null}
                  </a>
                  <figcaption className="flex flex-col gap-1.5 px-2 py-1.5">
                    <span className="text-foreground truncate text-xs font-medium">{shot.label}</span>
                    <span className="text-foreground-subtle truncate text-[0.7rem]">
                      {view?.aspect ?? '—'} · {shot.provider}
                      {typeof shot.costUsd === 'number' ? ` · $${shot.costUsd.toFixed(3)}` : ''}
                    </span>
                    {/* The shot's own prompt, not a recomposed one: this is what produced *this*
                        image, even if a field has been edited since. */}
                    <CopyButton value={shot.prompt} label="Copy prompt" className="self-start" />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </Block>

      <dl className="border-border text-foreground-subtle grid grid-cols-1 gap-x-8 gap-y-2 border-t pt-4 text-xs sm:grid-cols-3">
        <Meta label="Created" value={new Date(asset.createdAt).toLocaleString()} />
        <Meta label="Updated" value={new Date(asset.updatedAt).toLocaleString()} />
        <Meta label="Asset id" value={asset.id} mono />
      </dl>
    </div>
  );
}
AssetOverview.displayName = 'AssetOverview';

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-border flex flex-col gap-0.5 border-b pb-2">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        {description ? <p className="text-foreground-muted text-xs">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A read-only prompt with its own copy control. Scrolls rather than pushing the page down. */
function PromptBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground-subtle text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        <CopyButton value={value} />
      </div>
      <pre className="border-border bg-surface-raised text-foreground-muted max-h-72 overflow-auto rounded-lg border px-3 py-2 font-sans text-sm leading-relaxed whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function Absent({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground-subtle text-sm leading-relaxed">{children}</p>;
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-medium tracking-wide uppercase">{label}</dt>
      <dd className={cn('text-foreground-muted truncate', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}
