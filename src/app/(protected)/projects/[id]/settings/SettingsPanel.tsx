import { cn } from '@/lib/cn';

export interface SettingsPanelProps {
  title: string;
  description?: string;
  /** Renders the panel in the destructive palette — used by the danger zone. */
  tone?: 'default' | 'danger';
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One settings sub-page section. Deliberately not HeroUI's `Card` — the settings pages need a
 * flush footer bar that sits on its own surface, which the Card slots do not provide.
 */
export function SettingsPanel({
  title,
  description,
  tone = 'default',
  footer,
  children,
}: SettingsPanelProps) {
  return (
    <section
      className={cn(
        'elevation-sm bg-surface overflow-hidden rounded-2xl border',
        tone === 'danger' ? 'border-destructive/35' : 'border-border',
      )}
    >
      <div className="border-border flex flex-col gap-1 border-b px-6 py-5">
        <h2
          className={cn(
            'text-base font-semibold',
            tone === 'danger' ? 'text-destructive-text' : 'text-foreground',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-foreground-muted text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>

      <div className="px-6 py-6">{children}</div>

      {footer ? (
        <div className="border-border bg-surface-raised border-t px-6 py-4">{footer}</div>
      ) : null}
    </section>
  );
}
SettingsPanel.displayName = 'SettingsPanel';
