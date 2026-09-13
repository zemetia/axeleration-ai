/**
 * Moved to `src/lib/concurrency.ts` — the ffmpeg assembly adapter needs it too, and a provider
 * adapter must not import from `@/ai`. Re-exported here so the graph's own call sites are unchanged.
 */
export { mapWithConcurrency } from '@/lib/concurrency';
