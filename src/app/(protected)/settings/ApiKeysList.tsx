'use client';

import { KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/hooks';
import { useApiKeys, useDeleteApiKey, useTestApiKey } from '@/hooks/queries';
import type { VerifyOutcome } from '@/providers/verify';

const OUTCOME_TONE: Record<VerifyOutcome, string> = {
  valid: 'text-success',
  invalid: 'text-destructive-text',
  unknown: 'text-warning-text',
};

/** The last thing the provider said about one key. Full-width so it wraps under its own row. */
function TestResult({ result }: { result?: { outcome: VerifyOutcome; detail: string } }) {
  if (!result) return null;
  return <p className={`w-full text-xs ${OUTCOME_TONE[result.outcome]}`}>{result.detail}</p>;
}

export function ApiKeysList() {
  const { data: keys, isLoading } = useApiKeys();
  const deleteApiKey = useDeleteApiKey();
  const testApiKey = useTestApiKey();
  /*
   * Keyed by key id rather than held as a single "last result", because the list shows several
   * keys and a result that floated to whichever row was tested most recently would read as a
   * verdict on the wrong provider.
   */
  const [results, setResults] = useState<Record<string, { outcome: VerifyOutcome; detail: string }>>({});

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  if (!keys || keys.length === 0) {
    return (
      <p className="border-border bg-surface-raised text-foreground-muted rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        No API keys saved yet.
      </p>
    );
  }

  async function handleDelete(id: string) {
    const result = await deleteApiKey.mutateAsync(id);
    if (result.message) {
      toast.error(result.message);
    }
  }

  async function handleTest(id: string) {
    const result = await testApiKey.mutateAsync(id);
    if (result.message) {
      toast.error(result.message);
      return;
    }
    const verification = result.verification;
    if (verification) {
      setResults((prev) => ({ ...prev, [id]: verification }));
    }
  }

  return (
    <ul className="divide-border border-border bg-surface divide-y overflow-hidden rounded-xl border">
      {keys.map((key) => (
        <li key={key.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
          <span
            className="bg-surface-raised text-foreground-subtle flex size-8 shrink-0 items-center justify-center rounded-lg"
            aria-hidden="true"
          >
            <KeyRound className="size-4" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-foreground truncate font-medium">
              {key.provider}
              {key.label ? <span className="text-foreground-muted"> — {key.label}</span> : null}
            </span>
            <span className="text-foreground-subtle font-mono text-xs">
              •••• {key.lastFour ?? '????'}
            </span>
          </span>

          <Badge variant={key.isActive ? 'success' : 'secondary'}>
            {key.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {/* "Active" is a stored flag, not a fact about the provider — a revoked key stays Active
              forever. This is the only control that asks the provider itself. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleTest(key.id)}
            disabled={testApiKey.isPending}
          >
            {testApiKey.isPending && testApiKey.variables === key.id ? 'Testing…' : 'Test'}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${key.provider} key`}
            className="hover:text-destructive-text"
            onClick={() => handleDelete(key.id)}
            disabled={deleteApiKey.isPending}
          >
            <Trash2 aria-hidden="true" />
          </Button>

          <TestResult result={results[key.id]} />
        </li>
      ))}
    </ul>
  );
}
ApiKeysList.displayName = 'ApiKeysList';
