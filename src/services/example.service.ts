// services/example.service.ts
//
// Template for a domain service. Copy this file and rename it to match your domain.
// Pattern: one service object per domain (e.g. userService, postService, authService).
//
// ─── Usage with TanStack Query ────────────────────────────────────────────────
//
//   // READ — useQuery
//   const { data, isLoading, error } = useQuery({
//     queryKey: ['examples', id],
//     queryFn: () => ExampleService.getById(id),
//   });
//
//   // CREATE / UPDATE / DELETE — useMutation
//   const mutation = useMutation({
//     mutationFn: (body: CreateExampleBody) => ExampleService.create(body),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['examples'] });
//       toast.success('Created successfully');
//     },
//     onError: (err: ApiError) => {
//       toast.error(err.message);
//     },
//   });
//
// ─── RULE: Never call `fetch` or `apiClient` directly in components/hooks ─────
//
//   BAD:  const res = await fetch('/api/examples')
//   BAD:  const res = await apiClient.get('/api/examples')
//   GOOD: ExampleService.getAll()  ← inside queryFn / mutationFn only
//
// ─────────────────────────────────────────────────────────────────────────────

import { apiClient } from './client';

// Replace with real response types from `./types` or a dedicated types file.
interface Example {
  id: string;
  name: string;
  createdAt: string;
}

interface CreateExampleBody {
  name: string;
}

interface UpdateExampleBody {
  name?: string;
}

export const ExampleService = {
  // GET /examples
  getAll(): Promise<Example[]> {
    return apiClient.get('/examples');
  },

  // GET /examples/:id
  getById(id: string): Promise<Example> {
    return apiClient.get(`/examples/${id}`);
  },

  // POST /examples
  create(body: CreateExampleBody): Promise<Example> {
    return apiClient.post('/examples', body);
  },

  // PATCH /examples/:id
  update(id: string, body: UpdateExampleBody): Promise<Example> {
    return apiClient.patch(`/examples/${id}`, body);
  },

  // DELETE /examples/:id
  remove(id: string): Promise<void> {
    return apiClient.delete(`/examples/${id}`);
  },
};
