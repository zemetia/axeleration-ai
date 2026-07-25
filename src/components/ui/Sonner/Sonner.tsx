'use client';

import { Toaster as SonnerToaster } from 'sonner';
import type { ComponentProps } from 'react';

type SonnerProps = ComponentProps<typeof SonnerToaster>;

export function Toaster(props: SonnerProps) {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'font-sans! rounded-lg! border-border! bg-surface! text-foreground! shadow-lg!',
          title: 'text-foreground! font-medium!',
          description: 'text-foreground-muted!',
          actionButton: 'bg-primary! text-primary-foreground! font-medium!',
          cancelButton: 'bg-surface-raised! text-foreground-muted!',
          closeButton: 'border-border! bg-surface-raised! text-foreground-muted! hover:text-foreground!',
        },
      }}
      {...props}
    />
  );
}

Toaster.displayName = 'Toaster';
