'use client';

import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import { ASSET_TYPES, assetSchemaOf, isWideField } from '@/config/asset-schema';
import { useUpsertAsset } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import type { AssetAttributeValue, AssetAttributes } from '@/lib/validations';
import type { AssetType } from '@prisma/client';

import { AssetAttributeField } from './AssetAttributeField';
import { accentOf } from './asset-ui';
import { SlideOver } from './SlideOver';

const FORM_ID = 'asset-editor-form';

/**
 * Quick add — the one-screen path for an asset the user already has a reference for.
 *
 * Creation only. Editing an existing asset happens on its own page, where the same fields sit
 * beside the lab that re-renders it; a second edit surface would be two places to change one thing.
 */
export interface AssetEditorProps {
  projectId: string;
  onClose: () => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function AssetEditor({ projectId, onClose }: AssetEditorProps) {
  const upsertAsset = useUpsertAsset(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<AssetType>('CHARACTER');
  const [handle, setHandle] = useState('');
  const [isHandleEdited, setIsHandleEdited] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [attributes, setAttributes] = useState<AssetAttributes>({});
  const [filePreview, setFilePreview] = useState<{ url: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const schema = assetSchemaOf(type);
  const accent = accentOf(type);
  const isVoice = type === 'VOICE';

  // Object URLs for the local preview have to be revoked or the blob leaks for the tab's lifetime.
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview]);

  function setAttribute(key: string, value: AssetAttributeValue) {
    setAttributes((current) => ({ ...current, [key]: value }));
  }

  function handleNameChange(next: string) {
    setName(next);
    if (!isHandleEdited) setHandle(slugify(next));
  }

  function previewFile(file: File | undefined) {
    setFilePreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return file ? { url: URL.createObjectURL(file), name: file.name } : null;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file || !fileInputRef.current) return;
    // Assigning the FileList straight across keeps the native input as the single source of
    // truth, so the dropped file submits with the form like a picked one.
    fileInputRef.current.files = event.dataTransfer.files;
    previewFile(file);
  }

  function clearFile() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    previewFile(undefined);
  }

  async function handleAction(formData: FormData) {
    setError(undefined);
    formData.set('type', type);
    formData.set('handle', handle);
    formData.set('name', name);
    formData.set('description', description);
    // Only a VOICE asset carries a voiceId — avoid leaking a stale value if the user picked
    // VOICE, typed an id, then switched the type back.
    formData.set('voiceId', isVoice ? voiceId : '');
    formData.set('attributes', JSON.stringify(attributes));

    const result = await upsertAsset.mutateAsync(formData);
    if (result.errors) {
      setError(Object.values(result.errors)[0]?.[0]);
      return;
    }
    if (result.message) {
      setError(result.message);
      return;
    }
    onClose();
  }

  return (
    <SlideOver
      isOpen
      size="lg"
      onClose={onClose}
      title="New asset"
      subtitle={schema.tagline}
      footer={
        <>
          {error ? <p className="text-destructive-text mr-auto text-sm">{error}</p> : null}
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={upsertAsset.isPending}>
            {upsertAsset.isPending ? 'Saving…' : 'Add asset'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} action={handleAction} className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Type"
            description="Decides which details the asset asks for — switch it any time."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ASSET_TYPES.map((option) => {
              const optionAccent = accentOf(option);
              const OptionIcon = optionAccent.icon;
              const isActive = option === type;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setType(option)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
                    'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    isActive
                      ? cn(optionAccent.border, optionAccent.surface)
                      : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <OptionIcon aria-hidden className={cn('size-4', optionAccent.text)} />
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isActive ? optionAccent.text : 'text-foreground',
                    )}
                  >
                    {assetSchemaOf(option).label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-foreground-muted text-xs">{schema.tagline}</p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInputField label="Name" value={name} onChange={handleNameChange} isRequired />
          <TextInputField
            label="Handle"
            hint={`@mention token, e.g. @${schema.handleExample}. Fixed once saved.`}
            value={handle}
            onChange={(next) => {
              setIsHandleEdited(true);
              setHandle(slugify(next));
            }}
            isRequired
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label="Description"
              hint="The lead sentence injected into the prompt. Everything below is appended to it."
              placeholder={`One or two sentences describing this ${schema.label.toLowerCase()}`}
              value={description}
              onChange={setDescription}
              rows={3}
            />
          </div>
          {isVoice ? (
            <div className="sm:col-span-2">
              <TextInputField
                label="Provider voice ID"
                hint="e.g. an ElevenLabs voice id — required for text-to-speech generation."
                value={voiceId}
                onChange={setVoiceId}
              />
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading title={schema.reference.label} description={schema.reference.hint} />
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
            {filePreview ? (
              <div className="flex w-full flex-col items-center gap-3">
                {isVoice ? (
                  <audio controls src={filePreview.url} className="w-full" />
                ) : (
                  // Local storage serves arbitrary user uploads through /media — see AssetCard.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={filePreview.url}
                    alt="Reference preview"
                    className="border-border max-h-56 rounded-lg border object-contain"
                  />
                )}
                <p className="text-foreground-subtle text-xs">{filePreview.name}</p>
              </div>
            ) : (
              <>
                <ImagePlus
                  aria-hidden
                  className="text-foreground-subtle size-7"
                  strokeWidth={1.25}
                />
                <p className="text-foreground-muted text-sm">
                  Drop {schema.reference.kind === 'audio' ? 'an audio sample' : 'an image'} here, or
                  pick a file
                </p>
              </>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden />
                Choose file
              </Button>
              {filePreview ? (
                <Button type="button" size="sm" variant="ghost" onClick={clearFile}>
                  <Trash2 aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>

            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept={schema.reference.accept}
              onChange={(event) => previewFile(event.target.files?.[0])}
              className="sr-only"
            />
          </div>
        </section>

        {schema.sections.map((section) => (
          <section key={section.id} className="flex flex-col gap-3">
            <SectionHeading title={section.title} description={section.description} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className={cn(isWideField(field) && 'sm:col-span-2')}>
                  <AssetAttributeField
                    field={field}
                    value={attributes[field.key]}
                    onChange={setAttribute}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </form>
    </SlideOver>
  );
}
AssetEditor.displayName = 'AssetEditor';

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-border flex flex-col gap-0.5 border-b pb-2">
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      {description ? <p className="text-foreground-muted text-xs">{description}</p> : null}
    </div>
  );
}
