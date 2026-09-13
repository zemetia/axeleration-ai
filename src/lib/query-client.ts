import { QueryClient, dehydrate, type DehydratedState, type QueryKey } from '@tanstack/react-query';

/**
 * One QueryClient configuration for both sides of the render.
 *
 * The browser client and the server-side prefetch must agree on `staleTime`, or every
 * server-hydrated query is considered stale the instant it lands and refetches immediately —
 * which is exactly the round trip the prefetch was meant to remove.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        // Every mounted query refetching on tab focus is a real cost here: each one is an auth
        // cookie verify plus a DB round trip, and none of this data changes while the user is
        // looking at another window. Polling (`refetchInterval`) still runs for the stages and
        // scenes views, which is where live updates actually matter.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

/**
 * Builds the `state` for a `<HydrationBoundary>` from data a server component already has.
 *
 * Deliberately takes resolved values rather than fetchers, and builds a throwaway client per
 * call: nested boundaries (episode layout seeds stages, the scenes page seeds scenes) then each
 * carry only their own keys instead of re-serialising everything an ancestor already sent.
 */
export function dehydrateQueries(entries: Array<[QueryKey, unknown]>): DehydratedState {
  const queryClient = makeQueryClient();
  for (const [queryKey, data] of entries) {
    queryClient.setQueryData(queryKey, data);
  }
  return dehydrate(queryClient);
}
