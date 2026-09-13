import { cn } from '@/lib/cn';

export interface FooterProps {
  className?: string;
}

const FOOTER_LINKS = [
  { label: 'Next.js', href: 'https://nextjs.org' },
  { label: 'Storybook', href: 'https://storybook.js.org' },
  { label: 'Tailwind CSS', href: 'https://tailwindcss.com' },
] as const;

export function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('border-border bg-surface border-t', className)}>
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <p className="text-foreground-subtle text-sm">
          © {year} NextTemplate. Built with <span className="text-primary-text">♥</span>
        </p>

        <nav aria-label="Footer links" className="flex flex-wrap items-center gap-4">
          {FOOTER_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-subtle hover:text-foreground text-sm transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
