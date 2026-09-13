import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PageHeader } from '@/components/ui/PageHeader';
import { dehydrateQueries } from '@/lib/query-client';
import { buildMetadata } from '@/lib/seo';
import { assetService } from '@/services';

import { getProjectQuery } from '../../queries';
import { AssetLibraryContent } from './AssetLibraryContent';

type Props = {
  params: Promise<{ id: string }>;
  /**
   * `?asset=<handle>` — where a clicked `@handle` used to land, before assets had their own page.
   * Kept as a redirect: the handle is the only asset identifier that appears in prose, so links
   * already written into a script (or bookmarked) must keep resolving.
   */
  searchParams: Promise<{ asset?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({ title: 'Asset library', path: `/projects/${id}/assets`, noIndex: true });
}

export default async function AssetLibraryPage({ params, searchParams }: Props) {
  const [{ id }, { asset: openHandle }] = await Promise.all([params, searchParams]);

  // `getProjectQuery` is the ownership gate; the asset list is scoped to the same project id
  // and is thrown away below if that gate fails, so both can run at once.
  const [project, assets] = await Promise.all([getProjectQuery(id), assetService.list(id)]);
  if (!project) {
    notFound();
  }

  if (openHandle) {
    // Archived assets are not in the ACTIVE list above, and a mention still resolves to them.
    const target = await assetService.get(id, openHandle);
    if (target) redirect(`/projects/${id}/assets/${target.id}`);
  }

  // Seeds the exact key `useAssets(projectId)` reads, so the grid paints with the first HTML
  // instead of rendering ten skeletons and then asking the server for the same rows.
  return (
    <HydrationBoundary state={dehydrateQueries([[['assets', id, 'all', 'ACTIVE'], assets]])}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/dashboard' },
              { label: project.name, href: `/projects/${id}` },
              { label: 'Assets' },
            ]}
          />
          <PageHeader
            eyebrow={project.name}
            title="Asset library"
            description="Every asset carries a reference image and the details its type needs — personality for a character, weather for a location, projection for a map. @mention its handle in any prompt and all of it travels with the request."
          />
        </div>

        <AssetLibraryContent projectId={id} />
      </div>
    </HydrationBoundary>
  );
}
