'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProjectAction,
  deleteProjectAction,
  refinePremiseAction,
  resetCharacterBibleAction,
  updateProjectAction,
  type ActionResult,
  type RefinePremiseResult,
} from '@/app/(protected)/projects/actions';
import type { ProjectInput, ProjectUpdateInput } from '@/lib/validations';
import type { ProjectVO } from '@/types/value-objects';

import { getJson } from './fetcher';

/** `initialData` lets a server component hand over the first payload, removing the
 *  fetch-after-hydrate waterfall entirely. Omit it and the hook fetches as before. */
export function useProjects(initialData?: ProjectVO[]) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => getJson<ProjectVO[]>('/api/projects'),
    ...(initialData && { initialData }),
  });
}

export function useProject(projectId: string, initialData?: ProjectVO) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getJson<ProjectVO>(`/api/projects/${projectId}`),
    enabled: Boolean(projectId),
    ...(initialData && { initialData }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput): Promise<ActionResult> => createProjectAction(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectUpdateInput): Promise<ActionResult> => updateProjectAction(projectId, input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<ActionResult> => deleteProjectAction(projectId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useRefinePremise() {
  return useMutation({
    mutationFn: (input: { premise: string; projectType: string }): Promise<RefinePremiseResult> =>
      refinePremiseAction(input),
  });
}

export function useResetCharacterBible(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<ActionResult> => resetCharacterBibleAction(projectId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });
}
