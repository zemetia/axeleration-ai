import { Plus } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';

export function NewProjectButton() {
  return (
    <Link href="/projects/new" className={buttonVariants({ variant: 'primary', size: 'md' })}>
      <Plus aria-hidden="true" />
      New project
    </Link>
  );
}
NewProjectButton.displayName = 'NewProjectButton';
