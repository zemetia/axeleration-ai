import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireAuth } from '@/lib/auth';
import { resolveModel } from '@/lib/cost-forecast';
import { buildMetadata } from '@/lib/seo';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, assetService } from '@/services';

import { getProjectQuery } from '../../../queries';
import { AssetLab } from './AssetLab';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({ title: 'Asset lab', path: `/projects/${id}/assets/new`, noIndex: true });
}

/**
 * Same preflight rule as the episode room: check the credential *before* the button, not after the
 * spend. Image capabilities call `apiKeyService.getDecrypted` with no platform env fallback, so a
 * saved key is the only thing that makes a render possible.
 */
function missingCredentialNotice(
  modelConfig: ProjectModelConfig | undefined,
  savedProviders: string[],
): string | undefined {
  const image = resolveModel('textToImage', modelConfig);
  if (savedProviders.includes(image.provider)) return undefined;
  return `No API key saved for "${image.provider}", the provider this project renders images with. Add one in Settings → API keys or rendering will fail.`;
}

export default async function AssetLabPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAuth();

  const [project, styleAssets, credentials] = await Promise.all([
    getProjectQuery(id),
    assetService.list(id, { type: 'STYLE' }),
    apiKeyService.credentialedProviders(session.user.id),
  ]);
  if (!project) {
    notFound();
  }

  const modelConfig = (project.modelConfig as ProjectModelConfig | null) ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/dashboard' },
            { label: project.name, href: `/projects/${id}` },
            { label: 'Assets', href: `/projects/${id}/assets` },
            { label: 'New' },
          ]}
        />
        <PageHeader
          eyebrow={project.name}
          title="Asset lab"
          description="Write one prompt, let it expand into a full specification, then render the asset from every angle its type needs — a character turnaround, a location's coverage, a prop's orthographic set. The image you pick becomes the reference every later scene is generated against."
        />
      </div>

      <AssetLab
        projectId={id}
        styleAssets={styleAssets}
        modelConfig={modelConfig}
        missingCredential={missingCredentialNotice(modelConfig, credentials.saved)}
      />
    </div>
  );
}
