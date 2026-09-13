import { Bot, MonitorPlay, Settings2, ScrollText, TriangleAlert, Workflow } from 'lucide-react';

/** Sub-pages under `/projects/{id}/settings` — empty string is the index page. */
export type SettingsSegment = '' | 'story' | 'video' | 'pipeline' | 'ai-providers' | 'danger';

export interface SettingsNavItem {
  /** Appended to `/projects/{id}/settings` — empty string is the index page. */
  segment: SettingsSegment;
  label: string;
  description: string;
  icon: typeof Settings2;
  isDanger?: boolean;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    segment: '',
    label: 'General',
    description: 'Name, type and tags',
    icon: Settings2,
  },
  {
    segment: 'story',
    label: 'Story',
    description: 'Premise, tone and style',
    icon: ScrollText,
  },
  {
    segment: 'video',
    label: 'Video',
    description: 'Format, length and pacing',
    icon: MonitorPlay,
  },
  {
    segment: 'pipeline',
    label: 'Pipeline',
    description: 'Research and generation defaults',
    icon: Workflow,
  },
  {
    segment: 'ai-providers',
    label: 'AI providers',
    description: 'Chat, image, video and voice models',
    icon: Bot,
  },
  {
    segment: 'danger',
    label: 'Danger zone',
    description: 'Reset or delete this project',
    icon: TriangleAlert,
    isDanger: true,
  },
];

/** Built as template literals rather than a plain `string` so `typedRoutes` can match the route. */
export function settingsHref(projectId: string, segment: SettingsSegment) {
  return segment
    ? (`/projects/${projectId}/settings/${segment}` as const)
    : (`/projects/${projectId}/settings` as const);
}
