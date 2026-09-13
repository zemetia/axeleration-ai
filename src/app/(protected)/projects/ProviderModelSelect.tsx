'use client';

import Link from 'next/link';

import { ComboboxField } from '@/components/ui/ComboboxField';
import { SelectField } from '@/components/ui/SelectField';
import { aiConfig } from '@/config/ai';
import { useApiKeys, useProviderModels } from '@/hooks/queries';
import { providersFor, type ModelOption } from '@/providers/catalog';
import type { Capability } from '@/providers/types';

export interface ProviderModelValue {
  provider: string;
  model: string;
  apiKeyId?: string;
}

/**
 * Guarantees the currently-selected model still appears in the dropdown even if it fell out of the
 * live-fetched list (a stale project config, or a key that no longer unlocks that model) — the
 * alternative is `ComboboxField` silently blanking the field because `value` matches no option.
 */
function mergeModelOptions(options: ModelOption[], selected: string | undefined): ModelOption[] {
  if (!selected || options.some((option) => option.id === selected)) return options;
  return [{ id: selected, label: selected }, ...options];
}

export interface ProviderModelSelectProps {
  label: string;
  capability: Capability;
  /** `aiConfig.defaults` key this capability maps to — drives the "Use default" label. */
  defaultsKey: keyof typeof aiConfig.defaults;
  value?: ProviderModelValue;
  onChange: (value: ProviderModelValue | undefined) => void;
}

/** One capability's provider + model + which saved key to use, or "Use default" to fall back to `aiConfig.defaults`. */
export function ProviderModelSelect({
  label,
  capability,
  defaultsKey,
  value,
  onChange,
}: ProviderModelSelectProps) {
  const providers = providersFor(capability);
  const defaults = aiConfig.defaults[defaultsKey];
  const selectedProvider = providers.find((entry) => entry.provider === value?.provider);
  const staticModelOptions = selectedProvider?.models[capability] ?? [];

  const { data: apiKeys } = useApiKeys();
  const keysForProvider = (apiKeys ?? []).filter(
    (key) => key.provider === value?.provider && key.isActive,
  );

  /*
   * One query fetches every capability a vendor's key unlocks (see `model-discovery.ts`) — a
   * single WaveSpeed call, for instance, covers this row's image options *and* the video row's.
   * `staticModelOptions` (the curated `catalog.ts` list) is the fallback whenever discovery has
   * nothing for this specific capability, this vendor, or ran before a key was ever selected.
   */
  const { data: liveCatalog } = useProviderModels(value?.provider, value?.apiKeyId);
  const liveModels = liveCatalog?.[capability];
  const modelOptions = mergeModelOptions(liveModels?.length ? liveModels : staticModelOptions, value?.model);

  function handleProviderChange(provider: string) {
    if (!provider) {
      onChange(undefined);
      return;
    }
    const entry = providers.find((p) => p.provider === provider);
    const model = entry?.models[capability]?.[0]?.id ?? '';
    const firstKey = (apiKeys ?? []).find((key) => key.provider === provider && key.isActive);
    onChange({ provider, model, apiKeyId: firstKey?.id });
  }

  function handleModelChange(model: string) {
    if (!value?.provider) return;
    onChange({ ...value, model });
  }

  function handleApiKeyChange(apiKeyId: string) {
    if (!value?.provider) return;
    onChange({ ...value, apiKeyId: apiKeyId || undefined });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ComboboxField
        label={label}
        options={[
          { value: '', label: `Use default (${defaults.provider} — ${defaults.model})` },
          ...providers.map((entry) => ({ value: entry.provider, label: entry.label })),
        ]}
        value={value?.provider ?? ''}
        onChange={handleProviderChange}
        placeholder="Search providers…"
      />
      <ComboboxField
        label="Model"
        options={modelOptions.map((option) => ({
          value: option.id,
          label: option.label,
          description: option.description,
        }))}
        value={value?.model ?? ''}
        onChange={handleModelChange}
        disabled={!value?.provider || modelOptions.length === 0}
        placeholder="Search models…"
        emptyText="No models for this provider"
      />
      {value?.provider && keysForProvider.length === 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">API key</span>
          <p className="text-foreground-muted text-xs">
            No saved key for {value.provider} yet —{' '}
            <Link href="/settings" className="underline">
              add one
            </Link>
            .
          </p>
        </div>
      ) : (
        <SelectField
          label="API key"
          options={
            keysForProvider.length > 0
              ? keysForProvider.map((key) => ({
                  value: key.id,
                  label: key.label
                    ? `${key.label} (•••• ${key.lastFour ?? '????'})`
                    : `•••• ${key.lastFour ?? '????'}`,
                }))
              : [{ value: '', label: '—' }]
          }
          value={value?.apiKeyId ?? ''}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          disabled={!value?.provider}
        />
      )}
    </div>
  );
}
ProviderModelSelect.displayName = 'ProviderModelSelect';
