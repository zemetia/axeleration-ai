import { LogOut } from 'lucide-react';
import Link from 'next/link';

import { signOutAction } from '@/app/(protected)/actions';
import { Button } from '@/components/ui/Button';

import { AppNav } from './AppNav';

export interface AppHeaderProps {
  userEmail?: string | null;
}

/** First letter of the account, for the avatar disc when there is no picture to show. */
function initial(email: string | null | undefined): string {
  return email?.trim().charAt(0).toUpperCase() || '·';
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="container-studio flex h-16 items-center gap-4">
        <Link
          href="/dashboard"
          className="text-foreground flex shrink-0 items-center gap-2.5 rounded-lg"
        >
          <span
            className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold"
            aria-hidden="true"
          >
            A
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Axeleration Studio
          </span>
        </Link>

        <div className="ml-2 flex-1">
          <AppNav />
        </div>

        <div className="flex items-center gap-2">
          <div className="border-border bg-surface hidden items-center gap-2 rounded-full border py-1 pr-3 pl-1 md:flex">
            <span
              className="bg-surface-raised text-foreground-muted flex size-6 items-center justify-center rounded-full text-xs font-semibold"
              aria-hidden="true"
            >
              {initial(userEmail)}
            </span>
            <span className="text-foreground-muted max-w-[12rem] truncate text-xs">
              {userEmail ?? 'Signed in'}
            </span>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
AppHeader.displayName = 'AppHeader';
