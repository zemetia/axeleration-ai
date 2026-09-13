'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteApiKeyAction,
  saveApiKeyAction,
  testApiKeyAction,
  type ActionResult,
  type SaveApiKeyResult,
} from '@/app/(protected)/settings/actions';
import type { ApiKeyInput } from '@/lib/validations';
import type { ApiKeyVO } from '@/types/value-objects';

import { getJson } from './fetcher';

/** All of the signed-in user's saved keys, across every provider. */
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => getJson<ApiKeyVO[]>('/api/api-keys'),
  });
}

/*
 * `ActionResult`, not a structural `{ errors?: unknown }` — an `unknown` narrows to `{}` under a
 * truthiness check, so the caller's `setErrors(result.errors)` loses the field-error shape.
 */
function useApiKeysMutation<TInput>(mutationFn: (input: TInput) => Promise<ActionResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useSaveApiKey() {
  return useApiKeysMutation((input: ApiKeyInput) => saveApiKeyAction(input));
}

export function useDeleteApiKey() {
  return useApiKeysMutation((id: string) => deleteApiKeyAction(id));
}

/**
 * Re-tests an already-saved key. Also invalidates `episode-forecast`, because that query carries
 * the readiness check — a key the user just proved dead should stop the episode page from offering
 * to spend money through it.
 */
export function useTestApiKey() {
  const queryClient = useQueryClient();
  return useMutation<SaveApiKeyResult, Error, string>({
    mutationFn: (id: string) => testApiKeyAction(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['episode-forecast'] });
    },
  });
}
