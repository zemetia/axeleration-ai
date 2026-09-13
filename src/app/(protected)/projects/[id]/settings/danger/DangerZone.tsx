'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { TextInputField } from '@/components/ui/TextInputField';
import { toast } from '@/hooks';
import { useDeleteProject, useResetCharacterBible } from '@/hooks/queries';

import { SettingsPanel } from '../SettingsPanel';

export interface DangerZoneProps {
  projectId: string;
  projectName: string;
  episodeCount: number;
  assetCount: number;
}

export function DangerZone({ projectId, projectName, episodeCount, assetCount }: DangerZoneProps) {
  const router = useRouter();
  const resetBible = useResetCharacterBible(projectId);
  const deleteProject = useDeleteProject(projectId);

  const [confirmName, setConfirmName] = useState('');
  const canDelete = confirmName.trim() === projectName && !deleteProject.isPending;

  async function handleReset() {
    const result = await resetBible.mutateAsync();
    if (result.message) {
      toast.error(result.message);
      return;
    }
    toast.success('Character bible is regenerating');
  }

  async function handleDelete() {
    const result = await deleteProject.mutateAsync();
    if (result?.message) {
      toast.error(result.message);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel
        title="Regenerate character bible"
        description="Discards the current bible and rebuilds it from the story settings. Locked traits are cleared; episodes already produced are untouched."
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleReset}
              isLoading={resetBible.isPending}
            >
              {resetBible.isPending ? null : <RotateCcw aria-hidden="true" />}
              {resetBible.isPending ? 'Starting…' : 'Regenerate bible'}
            </Button>
          </div>
        }
      >
        <p className="text-foreground-muted text-sm">
          Useful after a big change to the premise or visual style — the bible is what keeps
          characters consistent across shots, so it should match the current story settings.
        </p>
      </SettingsPanel>

      <SettingsPanel
        tone="danger"
        title="Delete this project"
        description="Permanent. Every episode, scene and asset belonging to this project goes with it. Your saved API keys are unaffected — they live on your account."
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete}
            >
              <Trash2 aria-hidden="true" />
              {deleteProject.isPending ? 'Deleting…' : 'Delete project'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <ul className="text-foreground-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <li>
              <span className="text-foreground font-semibold">{episodeCount}</span> episodes
            </li>
            <li>
              <span className="text-foreground font-semibold">{assetCount}</span> assets
            </li>
          </ul>
          <TextInputField
            label={`Type "${projectName}" to confirm`}
            value={confirmName}
            onChange={setConfirmName}
            placeholder={projectName}
            autoComplete="off"
          />
        </div>
      </SettingsPanel>
    </div>
  );
}
DangerZone.displayName = 'DangerZone';
