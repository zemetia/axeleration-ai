import { Annotation, Command, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

/**
 * The contract behind `discardQueuedTasks` in `graph.ts`, proved against LangGraph itself rather
 * than against our nodes — the behaviour being pinned belongs to the Pregel loop, and reproducing it
 * with three dummy nodes costs no provider call.
 *
 * What went wrong in production: a superstep is only checkpointed once *every* task in it has
 * written, so a node that throws leaves its task pending for ever and LangGraph re-creates it on
 * every later entry. Re-entering upstream with `Command({ goto })` then runs the requested node and
 * the stale one *together* — separate `branch:to:*` triggers, so `interruptAfter` cannot park
 * between them — and the invoke fails with the stale node's error.
 */

const Ann = Annotation.Root({
  trail: Annotation<string[]>({ reducer: (a, b) => [...(a ?? []), ...(b ?? [])], default: () => [] }),
});

function buildHarness() {
  const runs = { A: 0, B: 0, C: 0 };
  /** C stands in for MUSIC: a node whose provider has no credential. */
  let cFails = true;

  const graph = new StateGraph(Ann)
    .addNode('A', async () => {
      runs.A += 1;
      return { trail: ['A'] };
    })
    .addNode('B', async () => {
      runs.B += 1;
      return { trail: ['B'] };
    })
    .addNode('C', async () => {
      runs.C += 1;
      if (cFails) throw new Error('401 Unauthenticated');
      return { trail: ['C'] };
    })
    .addEdge(START, 'A')
    .addEdge('A', 'B')
    .addEdge('B', 'C')
    .addEdge('C', END)
    .compile({ checkpointer: new MemorySaver(), interruptAfter: ['A', 'B', 'C'] });

  const config = { configurable: { thread_id: 'episode-1' } };

  /** Walks the thread to "C has failed once", the state a real episode was found wedged in. */
  async function wedge() {
    await graph.invoke({}, config);
    await graph.invoke(null, config);
    await expect(graph.invoke(null, config)).rejects.toThrow('401');
    expect((await graph.getState(config)).next).toEqual(['C']);
  }

  return { graph, config, runs, wedge, stopFailing: () => (cFails = false) };
}

describe('a failed node left queued on the thread', () => {
  it('re-runs on an upstream re-entry, and its error is what the caller sees', async () => {
    const { graph, config, runs, wedge } = buildHarness();
    await wedge();

    // The user asks to regenerate A. Nothing about C was requested.
    await expect(graph.invoke(new Command({ goto: 'A' }), config)).rejects.toThrow('401');

    expect(runs.A).toBe(2); // A did run…
    expect(runs.C).toBe(2); // …and C ran again alongside it, billed and unasked for.
    // Worse, the thread stays wedged: every later entry pays for C again.
    expect((await graph.getState(config)).next).toContain('C');
  });

  it('is discarded by updateState(null, END), so the re-entry runs only what was asked', async () => {
    const { graph, config, runs, wedge, stopFailing } = buildHarness();
    await wedge();

    // What `discardQueuedTasks` does.
    await graph.updateState(config, null, END);
    expect((await graph.getState(config)).next).toEqual([]);

    stopFailing();
    await graph.invoke(new Command({ goto: 'A' }), config);

    expect(runs.A).toBe(2);
    expect(runs.C).toBe(1); // still just the original failure — nothing re-billed
    // Parked exactly where a single-file pipeline should be: A ran, B is next.
    expect((await graph.getState(config)).next).toEqual(['B']);
  });

  it('keeps the channel values written by tasks that did succeed', async () => {
    const { graph, config, wedge } = buildHarness();
    await wedge();

    await graph.updateState(config, null, END);

    // A and B both completed before C failed; discarding C's task must not discard their output.
    expect((await graph.getState(config)).values.trail).toEqual(['A', 'B']);
  });
});
