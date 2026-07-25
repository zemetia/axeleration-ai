import { cn } from '@/lib/cn';

export interface FooterProps {
  className?: string;
}

const FOOTER_LINKS = [
  { label: 'Next.js', href: 'https://nextjs.org' },
  { label: 'Storybook', href: 'https://storybook.js.org' },
  { label: 'next-intl', href: 'https://next-intl-docs.vercel.app' },
  { label: 'Tailwind CSS', href: 'https://tailwindcss.com' },
] as const;

export function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('border-t border-border/50 bg-surface', className)}>
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <p className="text-sm text-foreground-subtle">
          © {year} NextTemplate. Built with{' '}
          <span className="text-primary">♥</span>
        </p>

        <nav aria-label="Footer links" className="flex flex-wrap items-center gap-4">
          {FOOTER_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground-subtle transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
