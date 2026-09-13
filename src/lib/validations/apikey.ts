import { z } from 'zod';

export const apiKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(60),
  label: z.string().max(120).optional(),
  apiKey: z.string().min(1, 'API key is required'),
});

export type ApiKeyInput = z.infer<typeof apiKeySchema>;
