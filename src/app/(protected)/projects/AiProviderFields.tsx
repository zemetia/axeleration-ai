'use client';

import Link from 'next/link';

import { Typography } from '@/components/ui/Typography';
import type { Capability, ProjectModelConfig } from '@/providers/types';

import { ProviderModelSelect, type ProviderModelValue } from './ProviderModelSelect';
import type { ProjectFieldsProps } from './ProjectBasicsFields';

/** One capability group — Chat, Image, Video and Voice each get their own provider/model, never shared. */
const GROUPS: {
  title: string;
  description: string;
  rows: { label: string; capability: Capability; key: keyof ProjectModelConfig }[];
}[] = [
  {
    title: 'Chat',
    description: 'Writes the character bible, script, scene and voice-line text.',
    rows: [{ label: 'Chat model', capability: 'llm-text', key: 'llmText' }],
  },
  {
    title: 'Image generation',
    description: 'Scene stills and reference-image edits.',
    rows: [
      { label: 'Text → Image', capability: 'text-to-image', key: 'textToImage' },
      { label: 'Image → Image', capability: 'image-to-image', key: 'imageToImage' },
    ],
  },
  {
    title: 'Video generation',
    description: 'Scene clips, generated from a prompt or from a reference image.',
    rows: [
      { label: 'Text → Video', capability: 'text-to-video', key: 'textToVideo' },
      { label: 'Image → Video', capability: 'image-to-video', key: 'imageToVideo' },
    ],
  },
  {
    title: 'Voice generation',
    description: 'Narration and dialogue text-to-speech.',
    rows: [{ label: 'Text-to-speech', capability: 'tts', key: 'tts' }],
  },
];

export function AiProviderFields({ value, onChange }: ProjectFieldsProps) {
  const modelConfig = value.modelConfig;

  function patchRow(key: keyof ProjectModelConfig, next: ProviderModelValue | undefined) {
    const nextConfig = { ...modelConfig };
    if (next) {
      nextConfig[key] = next;
    } else {
      delete nextConfig[key];
    }
    onChange({ modelConfig: nextConfig });
  }

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-4">
          <div>
            <Typography variant="small">{group.title}</Typography>
            <p className="text-foreground-muted text-xs">{group.description}</p>
          </div>
          <div className="flex flex-col gap-4">
            {group.rows.map((row) => (
              <ProviderModelSelect
                key={row.key}
                label={row.label}
                capability={row.capability}
                defaultsKey={row.key}
                value={modelConfig[row.key]}
                onChange={(next) => patchRow(row.key, next)}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="text-foreground-subtle text-xs">
        API keys are saved once on your{' '}
        <Link href="/settings" className="text-foreground font-medium underline">
          account settings
        </Link>{' '}
        and can be reused across every project — add multiple keys for the same provider to switch
        between them here.
      </p>
    </div>
  );
}
AiProviderFields.displayName = 'AiProviderFields';
