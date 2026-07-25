import { cn } from '@/lib/cn';

export interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}

export function PageWrapper({ children, className, narrow = false }: PageWrapperProps) {
  return (
    <div
      className={cn(
        'container-page py-12',
        narrow && 'max-w-3xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
