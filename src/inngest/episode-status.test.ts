import { describe, expect, it } from 'vitest';

import { finalVideoUrlOf, isTerminalStatus, rollupStatus, sumCost } from './episode-status';

type StageRow = Parameters<typeof rollupStatus>[0][number];

function stage(kind: StageRow['kind'], status: StageRow['status']): StageRow {
  return { kind, status };
}

describe('rollupStatus', () => {
  it('is GENERATING while the pipeline is mid-flight', () => {
    expect(rollupStatus([stage('IDEA', 'READY'), stage('SCRIPT', 'PENDING'), stage('RENDER', 'PENDING')])).toBe('GENERATING');
  });

  it('is READY_FOR_REVIEW once RENDER produced a video', () => {
    expect(rollupStatus([stage('IDEA', 'APPROVED'), stage('RENDER', 'READY')])).toBe('READY_FOR_REVIEW');
  });

  it('is DONE once RENDER is approved', () => {
    expect(rollupStatus([stage('IDEA', 'APPROVED'), stage('RENDER', 'APPROVED')])).toBe('DONE');
  });

  it('a failed stage wins over everything else', () => {
    expect(rollupStatus([stage('SCENES', 'FAILED'), stage('RENDER', 'READY')])).toBe('FAILED');
  });
});

describe('sumCost', () => {
  it('adds stage costs and treats a missing estimate as zero', () => {
    expect(sumCost([{ costEstimate: null }, { costEstimate: 1.25 }, { costEstimate: 0.5 }] as Parameters<typeof sumCost>[0])).toBeCloseTo(
      1.75,
    );
  });
});

describe('finalVideoUrlOf', () => {
  it('reads the url out of the RENDER stage output', () => {
    const stages = [
      { kind: 'SCENES' as const, output: { scenes: [] } },
      { kind: 'RENDER' as const, output: { url: 'http://localhost:3000/media/final.mp4' } },
    ];
    expect(finalVideoUrlOf(stages)).toBe('http://localhost:3000/media/final.mp4');
  });

  it('returns null when RENDER has not produced anything yet', () => {
    expect(finalVideoUrlOf([{ kind: 'RENDER' as const, output: null }])).toBeNull();
  });
});

describe('isTerminalStatus', () => {
  it('only flags states worth notifying an external automation about', () => {
    expect(isTerminalStatus('READY_FOR_REVIEW')).toBe(true);
    expect(isTerminalStatus('DONE')).toBe(true);
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('GENERATING')).toBe(false);
    expect(isTerminalStatus('DRAFT')).toBe(false);
  });
});
