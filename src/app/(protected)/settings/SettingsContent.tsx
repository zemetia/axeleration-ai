'use client';

import { ApiKeyForm } from './ApiKeyForm';
import { ApiKeysList } from './ApiKeysList';

export function SettingsContent() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-foreground text-sm font-semibold">Saved keys</h2>
        <ApiKeysList />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-foreground text-sm font-semibold">Add a key</h2>
        <ApiKeyForm />
      </div>
    </div>
  );
}
SettingsContent.displayName = 'SettingsContent';
