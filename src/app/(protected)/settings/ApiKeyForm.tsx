'use client';

import { useState } from 'react';

import type { SaveApiKeyResult } from '@/app/(protected)/settings/actions';
import { Button } from '@/components/ui/Button';
import { TextInputField } from '@/components/ui/TextInputField';
import { SelectField } from '@/components/ui/SelectField';
import { useSaveApiKey } from '@/hooks/queries';
import { aiConfig } from '@/config/ai';

const PROVIDERS = Object.keys(aiConfig.costTable);

export function ApiKeyForm() {
  const saveApiKey = useSaveApiKey();

  const [provider, setProvider] = useState(PROVIDERS[0] ?? 'fal');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SaveApiKeyResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setResult(null);

    // The action tests the key against the provider before storing it, so this await covers a real
    // network round trip — hence the "Testing…" label rather than "Saving…".
    const saved = await saveApiKey.mutateAsync({
      provider,
      label: label || undefined,
      apiKey,
    });
    setResult(saved);

    if (saved.errors) {
      setErrors(saved.errors);
      return;
    }
    if (saved.message) return;

    setLabel('');
    setApiKey('');
  }

  const verification = result?.verification;

  return (
    <form
      onSubmit={handleSubmit}
      className="elevation-sm border-border bg-surface flex flex-col gap-4 rounded-lg border p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Provider"
          options={PROVIDERS.map((p) => ({ value: p, label: p }))}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
        <TextInputField
          label="Label (optional)"
          value={label}
          onChange={setLabel}
          placeholder="e.g. main account"
          hint="Lets you tell two keys for the same provider apart."
        />
      </div>
      <TextInputField
        label="API key"
        type="password"
        value={apiKey}
        onChange={setApiKey}
        isRequired
        hint="Stored encrypted (AES-256-GCM). Never shown again after saving."
        error={errors['apiKey']?.[0]}
      />
      {/* Three outcomes, three messages. "Saved." on its own was the whole problem: it said the
          same thing for a working key and for the dead one this app has been carrying. */}
      {result?.message ? <p className="text-destructive-text text-sm">{result.message}</p> : null}
      {verification && !result?.errors ? (
        <p
          className={
            verification.outcome === 'valid' ? 'text-success text-sm' : 'text-warning-text text-sm'
          }
        >
          {verification.outcome === 'valid' ? 'Saved and tested — ' : 'Saved, but not tested — '}
          {verification.detail}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={saveApiKey.isPending}>
          {saveApiKey.isPending ? 'Testing…' : 'Save & test key'}
        </Button>
      </div>
    </form>
  );
}
ApiKeyForm.displayName = 'ApiKeyForm';
