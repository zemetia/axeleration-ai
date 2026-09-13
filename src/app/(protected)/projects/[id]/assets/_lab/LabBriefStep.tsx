'use client';

import { ChevronDown, ImagePlus, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible';
import { Spinner } from '@/components/ui/Spinner';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import { assetSchemaOf, isWideField } from '@/config/asset-schema';
import { cn } from '@/lib/cn';
import type { AssetAttributeValue, AssetAttributes } from '@/lib/validations';
import type { AssetType } from '@prisma/client';

import { AssetAttributeField } from '../AssetAttributeField';
import { accentOf } from '../asset-ui';

export interface LabBriefStepProps {
  type: AssetType;
  basePrompt: string;
  onBasePromptChange: (value: string) => void;
  onDraft: () => void;
  isDrafting: boolean;
  draftError?: string;
  name: string;
  onNameChange: (value: string) => void;
  handle: string;
  onHandleChange: (value: string) => void;
  /** Set when the asset already exists — prompts, scripts and scene beats already reference it. */
  isHandleLocked?: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  voiceId: string;
  onVoiceIdChange: (value: string) => void;
  attributes: AssetAttributes;
  onAttributeChange: (key: string, value: AssetAttributeValue) => void;
  referenceUrl?: string;
  onUpload: (file: File) => void;
  onClearReference: () => void;
  isUploading: boolean;
  uploadError?: string;
}

/**
 * The base prompt, what the AI made of it, and the reference that outranks both.
 *
 * The prompt box is deliberately the largest thing on the step: it is the one input the user
 * actually wants to write. Everything below it is the *draft* — editable, because the drafted
 * fields are what get baked into every render, and fixing an eye colour here costs nothing while
 * fixing it after eight images costs eight images.
 */
export function LabBriefStep({
  type,
  basePrompt,
  onBasePromptChange,
  onDraft,
  isDrafting,
  draftError,
  name,
  onNameChange,
  handle,
  onHandleChange,
  isHandleLocked = false,
  description,
  onDescriptionChange,
  voiceId,
  onVoiceIdChange,
  attributes,
  onAttributeChange,
  referenceUrl,
  onUpload,
  onClearReference,
  isUploading,
  uploadError,
}: LabBriefStepProps) {
  const schema = assetSchemaOf(type);
  const accent = accentOf(type);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isVoice = type === 'VOICE';

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  return (
    <div className="flex flex-col gap-8">
      <section
        className={cn(
          'flex flex-col gap-3 rounded-2xl border p-5',
          accent.border,
          accent.surface,
        )}
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Wand2 aria-hidden className={cn('size-4', accent.text)} />
            Base prompt
          </h3>
          <p className="text-foreground-muted text-xs">
            One or two sentences in your own words. Everything below is expanded from it — and every
            image is rendered from what is below.
          </p>
        </div>

        <TextAreaField
          label="Describe this asset"
          placeholder={`e.g. a ${schema.label.toLowerCase()} that…`}
          rows={4}
          value={basePrompt}
          onChange={onBasePromptChange}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={onDraft}
            disabled={isDrafting || basePrompt.trim().length < 3}
          >
            {isDrafting ? <Spinner size="sm" /> : <Sparkles aria-hidden />}
            {isDrafting ? 'Drafting…' : 'Draft the details'}
          </Button>
          <p className="text-foreground-subtle text-xs">
            Fills in the fields below. Nothing is generated and nothing is charged for images yet.
          </p>
        </div>
        {draftError ? <p className="text-destructive-text text-sm">{draftError}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInputField label="Name" value={name} onChange={onNameChange} isRequired />
        <TextInputField
          label="Handle"
          hint={
            isHandleLocked
              ? 'Fixed after creation — scripts and scene beats already mention it.'
              : `@mention token, e.g. @${schema.handleExample}. Fixed once saved.`
          }
          value={handle}
          onChange={onHandleChange}
          isRequired
          isDisabled={isHandleLocked}
        />
        <div className="sm:col-span-2">
          <TextAreaField
            label="Description"
            hint="The lead sentence of every prompt this asset appears in."
            rows={3}
            value={description}
            onChange={onDescriptionChange}
          />
        </div>
        {isVoice ? (
          <div className="sm:col-span-2">
            <TextInputField
              label="Provider voice ID"
              hint="e.g. an ElevenLabs voice id — required for text-to-speech generation."
              value={voiceId}
              onChange={onVoiceIdChange}
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="border-border flex flex-col gap-0.5 border-b pb-2">
          <h3 className="text-foreground text-sm font-semibold">{schema.reference.label}</h3>
          <p className="text-foreground-muted text-xs">
            {isVoice
              ? schema.reference.hint
              : 'Optional. Upload one and every view is rendered from it instead of from text — the strongest consistency lever there is.'}
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border border-dashed p-5 text-center transition-colors',
            isDragging ? cn(accent.border, accent.surface) : 'border-border bg-surface',
          )}
        >
          {referenceUrl ? (
            <div className="flex w-full flex-col items-center gap-2">
              {isVoice ? (
                <audio controls src={referenceUrl} className="w-full" />
              ) : (
                // Local storage serves user uploads through /media — not a Next-optimizable source.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={referenceUrl}
                  alt="Reference preview"
                  className="border-border max-h-56 rounded-lg border object-contain"
                />
              )}
              <Badge variant="success">Identity locked to this file</Badge>
            </div>
          ) : (
            <>
              <ImagePlus aria-hidden className="text-foreground-subtle size-7" strokeWidth={1.25} />
              <p className="text-foreground-muted text-sm">
                Drop {schema.reference.kind === 'audio' ? 'an audio sample' : 'an image'} here, or pick a file
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <Spinner size="sm" /> : <Upload aria-hidden />}
              {isUploading ? 'Uploading…' : referenceUrl ? 'Replace file' : 'Choose file'}
            </Button>
            {referenceUrl ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClearReference}>
                <Trash2 aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={schema.reference.accept}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = '';
            }}
            className="sr-only"
          />
        </div>
        {uploadError ? <p className="text-destructive-text text-sm">{uploadError}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="border-border flex flex-col gap-0.5 border-b pb-2">
          <h3 className="text-foreground text-sm font-semibold">Specification</h3>
          <p className="text-foreground-muted text-xs">
            Every filled field is appended to the prompt of every view. Empty ones are simply left out.
          </p>
        </div>

        {schema.sections.map((section) => (
          <LabFieldSection
            key={section.id}
            title={section.title}
            description={section.description}
            filledCount={section.fields.filter((field) => hasValue(attributes[field.key])).length}
            totalCount={section.fields.length}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className={cn(isWideField(field) && 'sm:col-span-2')}>
                  <AssetAttributeField
                    field={field}
                    value={attributes[field.key]}
                    onChange={onAttributeChange}
                  />
                </div>
              ))}
            </div>
          </LabFieldSection>
        ))}
      </section>
    </div>
  );
}
LabBriefStep.displayName = 'LabBriefStep';

function hasValue(value: AssetAttributeValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

/** A section collapses so a thirty-field type is still readable; the count says what is inside it. */
function LabFieldSection({
  title,
  description,
  filledCount,
  totalCount,
  children,
}: {
  title: string;
  description?: string;
  filledCount: number;
  totalCount: number;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(filledCount > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-border bg-surface rounded-xl border">
        <CollapsibleTrigger className="hover:bg-surface-raised focus-visible:ring-primary/25 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:ring-4 focus-visible:outline-none">
          <ChevronDown
            aria-hidden
            className={cn('text-foreground-subtle size-4 transition-transform', isOpen && 'rotate-180')}
          />
          <span className="min-w-0 flex-1">
            <span className="text-foreground block text-sm font-semibold">{title}</span>
            {description ? (
              <span className="text-foreground-muted block text-xs">{description}</span>
            ) : null}
          </span>
          <Badge variant={filledCount > 0 ? 'soft' : 'secondary'}>
            {filledCount}/{totalCount}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-border border-t p-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
