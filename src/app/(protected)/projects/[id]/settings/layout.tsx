import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PageHeader } from '@/components/ui/PageHeader';

import { getProjectQuery } from '../../queries';
import { ProjectSettingsNav } from './ProjectSettingsNav';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export default async function ProjectSettingsLayout({ params, children }: Props) {
  const { id } = await params;
  const project = await getProjectQuery(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/dashboard' },
            { label: project.name, href: `/projects/${id}` },
            { label: 'Settings' },
          ]}
        />
        <PageHeader
          eyebrow={project.name}
          title="Project settings"
          description="Changes apply to episodes generated from now on — episodes already produced keep the settings they were made with."
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ProjectSettingsNav projectId={id} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
