import { NextResponse } from 'next/server';

import { forecastEpisode, forecastScene, forecastStage } from '@/lib/cost-forecast';
import { buildForecastContext } from '@/lib/forecast-input';
import { readinessForEpisode } from '@/lib/provider-readiness';
import { requireAuth } from '@/lib/auth';

/**
 * What every stage of this episode would cost if it ran right now — and whether it *can* run.
 * Computed on the server because the numbers depend on the project's `modelConfig` — an override
 * the browser has no business holding — and on the current script, which changes every time a beat
 * is edited.
 *
 * Readiness is served from here rather than its own route on purpose: it needs the same
 * `modelConfig` and the same scene/dialogue counts as the forecast, so computing it beside the
 * price is both one fewer round trip on a path the episode page polls, and a guarantee that the
 * provider a stage is quoted against is the provider it is checked against. `buildForecastContext`
 * is shared with auto-pilot, so the budget it spends against is this exact forecast.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const context = await buildForecastContext(id, userId);
  if (!context) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const { forecast: input, readiness, scenes, remaining } = context;

  return NextResponse.json({
    stages: forecastEpisode(input),
    readiness: readinessForEpisode(readiness),
    scenes: Object.fromEntries(
      scenes.map((scene) => [scene.index, forecastScene(input, scene.durationSeconds)]),
    ),
    // What "Generate remaining scenes" costs: the SCENES stage priced over only the beats with no
    // clip yet, since the batch reuses the rest instead of paying for them again (`scenesNode`).
    scenesRemaining: forecastStage('SCENES', {
      ...input,
      sceneCount: remaining.length,
      totalSceneSeconds: remaining.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    }),
    remainingCount: remaining.length,
  });
}
