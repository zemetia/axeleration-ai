'use client';

import { Badge } from '@/components/ui/Badge';
import { NumberInputField } from '@/components/ui/NumberInputField';
import { SelectField } from '@/components/ui/SelectField';
import { FORMAT_PRESETS, matchPreset, presetPatch } from '@/config/format-presets';
import { ASPECT_RATIO_OPTIONS, RESOLUTION_OPTIONS } from '@/config/project-options';
import { cn } from '@/lib/cn';
import { estimateScenes, hasFewScenesWarning } from '@/lib/scene-estimate';
import type { AspectRatio, Resolution } from '@prisma/client';

import type { ProjectFieldsProps } from './ProjectBasicsFields';

export function VideoConfigFields({ value, onChange, errors }: ProjectFieldsProps) {
  const estimatedScenes = estimateScenes(value);
  const showWarning = hasFewScenesWarning(estimatedScenes);
  const activePreset = matchPreset(value);

  return (
    <div className="flex flex-col gap-6">
      {/* Four independent fields below, but for most videos they are one decision: where is this
          going? Picking a destination fills them in; nothing is locked afterwards. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-foreground mb-2 text-sm font-medium">Where is this going?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FORMAT_PRESETS.map((preset) => {
            const isActive = activePreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange(presetPatch(preset))}
                className={cn(
                  'flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors',
                  isActive
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised',
                )}
              >
                <span className="text-foreground text-sm font-medium">{preset.label}</span>
                <span className="text-foreground-subtle text-xs">{preset.description}</span>
              </button>
            );
          })}
        </div>
        <p className="text-foreground-subtle text-xs">
          {activePreset
            ? 'Every field below is still yours to change.'
            : 'Custom settings — no preset matches these values.'}
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SelectField
          label="Aspect ratio"
          options={ASPECT_RATIO_OPTIONS}
          value={value.aspectRatio}
          onChange={(e) => onChange({ aspectRatio: e.target.value as AspectRatio })}
          error={errors?.['aspectRatio']?.[0]}
        />
        <SelectField
          label="Resolution"
          options={RESOLUTION_OPTIONS}
          value={value.resolution}
          onChange={(e) => onChange({ resolution: e.target.value as Resolution })}
          error={errors?.['resolution']?.[0]}
        />
      </div>

      <NumberInputField
        label="Target episode length (seconds)"
        minValue={1}
        maxValue={3600}
        value={value.targetTotalSeconds}
        onChange={(targetTotalSeconds) => onChange({ targetTotalSeconds })}
        error={errors?.['targetTotalSeconds']?.[0]}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <NumberInputField
          label="Min scene duration (seconds)"
          minValue={1}
          maxValue={120}
          value={value.sceneDurationMin}
          onChange={(sceneDurationMin) => onChange({ sceneDurationMin })}
          error={errors?.['sceneDurationMin']?.[0]}
        />
        <NumberInputField
          label="Max scene duration (seconds)"
          minValue={1}
          maxValue={120}
          value={value.sceneDurationMax}
          onChange={(sceneDurationMax) => onChange({ sceneDurationMax })}
          error={errors?.['sceneDurationMax']?.[0]}
        />
      </div>

      <div className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
        <span className="text-foreground-muted">Estimated scenes per episode:</span>
        <Badge variant={showWarning ? 'warning' : 'secondary'}>~{estimatedScenes}</Badge>
        {showWarning ? (
          <span className="text-warning text-xs">
            Fewer than 3 scenes — consider a longer episode or shorter scenes.
          </span>
        ) : null}
      </div>
    </div>
  );
}
VideoConfigFields.displayName = 'VideoConfigFields';
