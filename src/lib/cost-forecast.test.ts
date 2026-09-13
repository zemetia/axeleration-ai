import { describe, expect, it } from 'vitest';

import {
  combineForecasts,
  forecastScene,
  forecastStage,
  resolveModel,
  type ForecastInput,
  type StageForecast,
} from './cost-forecast';

const base: ForecastInput = {
  modelConfig: undefined,
  researchMode: 'AI_CDP',
  sceneCount: 6,
  totalSceneSeconds: 48,
  dialogueChars: 2000,
  briefChars: 1200,
};

describe('resolveModel', () => {
  it('falls back to the static defaults when the project has no override', () => {
    expect(resolveModel('llmText', undefined)).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5' });
  });

  it('lets a project override win, the same precedence providerRegistry.select uses', () => {
    expect(resolveModel('llmText', { llmText: { provider: 'sumopod', model: 'claude-haiku-4-5' } })).toEqual({
      provider: 'sumopod',
      model: 'claude-haiku-4-5',
    });
  });
});

describe('forecastStage', () => {
  it('prices the scene batch on total seconds for a per-second video model', () => {
    const forecast = forecastStage('SCENES', base);
    const video = forecast.lines.find((entry) => entry.unit === 'second');

    // wavespeed seedance-2.0 text-to-video is $0.30/s in the cost table.
    expect(video?.units).toBe(48);
    expect(video?.usd).toBeCloseTo(14.4, 4);
    expect(forecast.hasUnpricedModel).toBe(false);
  });

  it('bills a per-call video model once per scene, not per second', () => {
    const forecast = forecastStage('SCENES', {
      ...base,
      modelConfig: { textToVideo: { provider: 'higgsfield', model: 'dop-standard' } },
    });
    const video = forecast.lines.find((entry) => entry.unit === 'call');

    expect(video?.units).toBe(6);
    expect(video?.usd).toBeCloseTo(6 * 0.406, 4);
  });

  it('reports an unpriced model instead of silently quoting zero', () => {
    const forecast = forecastStage('IDEA', {
      ...base,
      modelConfig: { llmText: { provider: 'anthropic', model: 'not-in-the-cost-table' } },
    });

    expect(forecast.hasUnpricedModel).toBe(true);
    expect(forecast.totalUsd).toBe(0);
  });

  it('charges nothing for research the user writes by hand, or skips', () => {
    expect(forecastStage('RESEARCH', { ...base, researchMode: 'HUMAN' }).isFree).toBe(true);
    expect(forecastStage('RESEARCH', { ...base, researchMode: 'SKIP' }).isFree).toBe(true);
    expect(forecastStage('RESEARCH', base).isFree).toBe(false);
  });

  it('quotes the web-research mode above the no-web one — the tool loop reads pages back into context', () => {
    const reasoning = forecastStage('RESEARCH', { ...base, researchMode: 'AI_REASONING' });
    const web = forecastStage('RESEARCH', { ...base, researchMode: 'AI_CDP' });

    expect(web.totalUsd).toBeGreaterThan(reasoning.totalUsd);
    expect(web.etaSeconds).toBeGreaterThan(reasoning.etaSeconds);
  });

  it('skips the voice pass when no beat has dialogue', () => {
    expect(forecastStage('VOICE', { ...base, dialogueChars: 0 }).isFree).toBe(true);
  });

  it('treats the local ffmpeg render as free but not instant', () => {
    const forecast = forecastStage('RENDER', base);

    expect(forecast.isFree).toBe(true);
    expect(forecast.etaSeconds).toBeGreaterThan(0);
  });

  it('quotes an empty script as free — there is nothing to generate', () => {
    expect(forecastStage('SCENES', { ...base, sceneCount: 0, totalSceneSeconds: 0 }).isFree).toBe(true);
  });

  it('runs the batch concurrently, so the eta is batches rather than the sum', () => {
    const one = forecastStage('SCENES', { ...base, sceneCount: 1, totalSceneSeconds: 8 });
    const six = forecastStage('SCENES', base);

    // sceneConcurrency is 3, so six beats are two batches, not six serial runs.
    expect(six.etaSeconds).toBe(one.etaSeconds * 2);
  });
});

describe('forecastScene', () => {
  it('prices one beat on its own duration', () => {
    const forecast = forecastScene(base, 8);
    const video = forecast.lines.find((entry) => entry.unit === 'second');

    expect(video?.units).toBe(8);
    expect(video?.usd).toBeCloseTo(2.4, 4);
  });
});

describe('combineForecasts', () => {
  /** Re-research is RESEARCH then IDEA on one click, so the dialog has to quote both as one number. */
  const research = forecastStage('RESEARCH', base);
  const idea = forecastStage('IDEA', base);

  it('sums the cost and the wall clock of the stages it runs', () => {
    const combined = combineForecasts(research, idea);

    expect(combined.lines).toHaveLength(research.lines.length + idea.lines.length);
    expect(combined.totalUsd).toBeCloseTo(research.totalUsd + idea.totalUsd, 4);
    expect(combined.etaSeconds).toBe(research.etaSeconds + idea.etaSeconds);
  });

  it('carries an unpriced model through, so the total stays a floor', () => {
    // Summing pre-computed totals would drop this flag and present a floor as a full quote.
    const unpriced: StageForecast = {
      lines: [{ label: 'x', provider: 'nobody', model: 'unknown', units: 1, unit: 'call', usd: null }],
      totalUsd: 0,
      hasUnpricedModel: true,
      etaSeconds: 10,
      isFree: false,
    };

    expect(combineForecasts(idea, unpriced).hasUnpricedModel).toBe(true);
  });

  it('is free only when every stage is', () => {
    const free = forecastStage('RESEARCH', { ...base, researchMode: 'SKIP' });

    expect(combineForecasts(free, forecastStage('BREAKDOWN', base)).isFree).toBe(true);
    expect(combineForecasts(free, idea).isFree).toBe(false);
  });
});
