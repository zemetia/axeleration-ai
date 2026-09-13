import { z } from 'zod';

/**
 * Per-project pipeline behaviour, stored in `Project.pipelineConfig`.
 *
 * Deliberately separate from `modelConfig` (which vendor runs a capability) and `styleConfig` (how
 * a shot should look): this is about which parts of the pipeline run at all. Parsed rather than
 * cast, because the column is free-form JSON that predates any of these keys.
 *
 * Note the file name: `src/config/pipeline.ts` is a different module (the stage order, added by
 * T15). This one holds only per-project switches.
 */

export const pipelineConfigSchema = z.object({
  /**
   * Complete the VOICE and MUSIC stages instantly, with empty output and no provider call.
   *
   * Audio is deferred while the video half of the pipeline is being reworked
   * (`docs/plan/tasks/T14-video-assembly-hardening.md`), and without this every approve-to-render
   * pass would bill a TTS and a music generation the user is not yet looking at. A switch, not a
   * removal — the nodes stay wired, so turning it off restores the old behaviour with no code change.
   */
  skipAudio: z.boolean().default(false),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = { skipAudio: false };

/** Never throws — an unreadable or absent config falls back to defaults rather than failing a run. */
export function readPipelineConfig(raw: unknown): PipelineConfig {
  const parsed = pipelineConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_PIPELINE_CONFIG;
}
