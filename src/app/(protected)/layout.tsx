import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { AppHeader } from '@/components/layout/AppHeader';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  return (
    <>
      <AppHeader userEmail={session?.user?.email} />
      <main className="container-studio pt-8 pb-24 sm:pt-10">{children}</main>
    </>
  );
}
