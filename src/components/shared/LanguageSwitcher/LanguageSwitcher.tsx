'use client';

import { useLocale } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

export interface LanguageSwitcherProps {
  className?: string;
}

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  id: 'ID',
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (nextLocale: string) => {
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={cn('flex items-center rounded-md border border-border bg-surface p-0.5', className)}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          aria-current={locale === loc ? 'true' : undefined}
          aria-label={`Switch to ${loc}`}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-semibold tracking-wide transition-all duration-150',
            locale === loc
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-foreground-subtle hover:text-foreground',
          )}
        >
          {LOCALE_LABELS[loc] ?? loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
