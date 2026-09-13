import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { requireAuth } from '@/lib/auth';
import { resolveModel } from '@/lib/cost-forecast';
import { buildMetadata } from '@/lib/seo';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, assetService } from '@/services';

import { getProjectQuery } from '../../../queries';
import { AssetDetailContent } from './AssetDetailContent';

type Props = { params: Promise<{ id: string; assetId: string }> };

/** Cached for the request: `generateMetadata` and the page both need the row. */
const getAssetQuery = cache(async (projectId: string, assetId: string) =>
  assetService.byId(projectId, assetId),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, assetId } = await params;
  const [project, asset] = await Promise.all([getProjectQuery(id), getAssetQuery(id, assetId)]);

  return buildMetadata({
    title: project && asset ? `${asset.name} · ${asset.typeLabel}` : 'Asset',
    path: `/projects/${id}/assets/${assetId}`,
    noIndex: true,
  });
}

/**
 * Same preflight rule as the asset lab: the credential is checked before the button, not after the
 * spend — a re-render from this page bills exactly like a first render does.
 */
function missingCredentialNotice(
  modelConfig: ProjectModelConfig | undefined,
  savedProviders: string[],
): string | undefined {
  const image = resolveModel('textToImage', modelConfig);
  if (savedProviders.includes(image.provider)) return undefined;
  return `No API key saved for "${image.provider}", the provider this project renders images with. Add one in Settings → API keys or rendering will fail.`;
}

export default async function AssetDetailPage({ params }: Props) {
  const { id, assetId } = await params;
  const session = await requireAuth();

  // `getProjectQuery` is the ownership gate; every other read is scoped to the same project id and
  // is thrown away below if that gate fails, so they can all run at once.
  const [project, asset, styleAssets, credentials] = await Promise.all([
    getProjectQuery(id),
    getAssetQuery(id, assetId),
    assetService.list(id, { type: 'STYLE' }),
    apiKeyService.credentialedProviders(session.user.id),
  ]);
  if (!project || !asset) {
    notFound();
  }

  const modelConfig = (project.modelConfig as ProjectModelConfig | null) ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/dashboard' },
          { label: project.name, href: `/projects/${id}` },
          { label: 'Assets', href: `/projects/${id}/assets` },
          { label: asset.name },
        ]}
      />

      <AssetDetailContent
        projectId={id}
        projectName={project.name}
        asset={asset}
        // A STYLE asset cannot inherit itself.
        styleAssets={styleAssets.filter((style) => style.id !== asset.id)}
        modelConfig={modelConfig}
        missingCredential={missingCredentialNotice(modelConfig, credentials.saved)}
      />
    </div>
  );
}
