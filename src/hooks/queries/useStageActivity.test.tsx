import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The module under test imports the episode Server Actions, whose `'use server'` boundary is a
// build-time fiction here: importing it for real drags in `next-auth` → `next/server`, which does
// not resolve outside the Next runtime. None of these are called by the hook under test.
vi.mock('@/app/(protected)/projects/[id]/episodes/actions', () => ({
  addScriptSceneAction: vi.fn(),
  approveStageAction: vi.fn(),
  deleteScriptSceneAction: vi.fn(),
  refineIdeaAction: vi.fn(),
  refineScriptAction: vi.fn(),
  regenerateStageAction: vi.fn(),
  rerunResearchAction: vi.fn(),
  updateScriptAction: vi.fn(),
  writeIdeaAction: vi.fn(),
}));

import { useStageActivity } from './useEpisodeStages';

/**
 * The regression these cover is not a wrong value — it is a wrong *number of connections*.
 *
 * `useStageActivity` used to open an `EventSource` per component instance, and the Idea room mounts
 * four readers of the same episode (`RunningBanner` plus a `StagePanel` each for Research, Idea and
 * Script). An SSE response holds its socket for the life of the page and a browser gives an
 * HTTP/1.1 origin six of them, so those four starved everything else on the page — polling, RSC
 * prefetches, and the Server Action behind "Save beat", which then never got a socket at all.
 */

const opened: FakeEventSource[] = [];

class FakeEventSource {
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  isClosed = false;

  constructor(url: string) {
    this.url = url;
    opened.push(this);
  }

  close() {
    this.isClosed = true;
  }
}

vi.stubGlobal('EventSource', FakeEventSource);

function Reader({ episodeId }: { episodeId: string }) {
  const activity = useStageActivity(episodeId);
  return <span>{activity.SCRIPT ?? ''}</span>;
}

function Readers({ episodeIds }: { episodeIds: string[] }) {
  return (
    <>
      {episodeIds.map((episodeId, index) => (
        <Reader key={index} episodeId={episodeId} />
      ))}
    </>
  );
}

function renderReaders(episodeIds: string[]) {
  // Retries off so a hook error surfaces as a failure rather than a hang. The client and the
  // wrapper are stable across rerenders on purpose: `useStageActivity` keys its effect on the
  // query client, and `Reader`s are keyed by position, so shrinking the list unmounts exactly one
  // of them instead of remounting the lot — which is the thing the ref-counting has to survive.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Readers episodeIds={episodeIds} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerenderWith: (next: string[]) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Readers episodeIds={next} />
        </QueryClientProvider>,
      ),
  };
}

describe('useStageActivity', () => {
  beforeEach(() => {
    opened.length = 0;
  });

  it('opens one connection for many readers of the same episode', () => {
    renderReaders(['ep-1', 'ep-1', 'ep-1', 'ep-1']);

    expect(opened).toHaveLength(1);
    expect(opened[0]?.url).toBe('/api/episodes/ep-1/activity');
  });

  it('keeps episodes on separate connections', () => {
    renderReaders(['ep-1', 'ep-1', 'ep-2']);

    expect(opened.map((source) => source.url)).toEqual([
      '/api/episodes/ep-1/activity',
      '/api/episodes/ep-2/activity',
    ]);
  });

  it('holds the connection open until the last reader unmounts', () => {
    const { rerenderWith, unmount } = renderReaders(['ep-1', 'ep-1']);

    // One of the two goes away — the survivor still needs the stream.
    rerenderWith(['ep-1']);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.isClosed).toBe(false);

    unmount();
    expect(opened[0]?.isClosed).toBe(true);
  });

  it('pushes a streamed line into every reader of the one connection', async () => {
    const { findAllByText } = renderReaders(['ep-1', 'ep-1']);

    // Let the query's own (empty) initial fetch settle first: `setQueryData` on a still-pending
    // query is overwritten when that fetch resolves. Nothing publishes on subscribe in the real
    // bus (see `activity-bus.ts`), so this ordering is a test artefact, not a live race.
    await act(async () => undefined);

    act(() => {
      opened[0]?.onmessage?.({
        data: JSON.stringify({ kind: 'SCRIPT', activity: 'Writing beats' }),
      });
    });

    // `findAllByText`, not `getAllByText`: React Query batches cache notifications through its own
    // scheduler, so the re-render lands a tick after the `act` above returns.
    expect(await findAllByText('Writing beats')).toHaveLength(2);
  });
});
