'use client';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'elevation-sm border-border bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md',
        className,
      )}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="text-foreground flex items-center gap-2 font-bold tracking-tight">
          <span
            className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md text-sm font-black"
            aria-hidden="true"
          >
            N
          </span>
          <span>NextTemplate</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          <Link
            href="/"
            className="text-foreground-muted hover:text-foreground text-sm transition-colors"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="text-foreground-muted hover:text-foreground text-sm transition-colors"
          >
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/sign-in" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            Sign In
          </Link>
          <Link href="/register" className={buttonVariants({ size: 'sm' })}>
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
