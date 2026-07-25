'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { Button } from '@/components/ui/Button';

export interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const t = useTranslations('navigation');

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md',
        className,
      )}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-black"
            aria-hidden="true"
          >
            N
          </span>
          <span>NextTemplate</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          <Link
            href="/"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            {t('home')}
          </Link>
          <Link
            href="/about"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            {t('about')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button size="sm" variant="ghost">
            {t('signIn')}
          </Button>
          <Button size="sm">{t('getStarted')}</Button>
        </div>
      </div>
    </header>
  );
}
