'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

// Type-only import: erased at compile time, so it does not pull posthog-js into the graph.
import type { PostHog } from 'posthog-js';

const PostHogContext = createContext<PostHog | null>(null);

/** Returns the PostHog client once it has loaded, or `null` before that / when unconfigured. */
export function usePostHog(): PostHog | null {
  return useContext(PostHogContext);
}

/**
 * `posthog-js` is ~60KB and used to be imported at module scope in a provider mounted in
 * the root layout — so every route, including the public marketing pages, shipped it in
 * the first-load bundle and executed it before hydration finished, even with no key set.
 *
 * It is now loaded on demand: only when a key exists, only in the browser, and only once
 * the browser reports idle. Nothing about analytics needs to block first paint.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    let cancelled = false;
    const load = () => {
      void import('posthog-js').then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
          capture_pageview: false,
          capture_pageleave: true,
          person_profiles: 'identified_only',
        });
        setClient(() => posthog);
      });
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    const handle = idle(load);

    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(handle as number);
    };
  }, []);

  // Fires for the landing route too: `client` flips from null to the instance after load,
  // which re-runs this effect while `pathname` is still the entry path.
  useEffect(() => {
    if (!client || lastPath.current === pathname) return;
    lastPath.current = pathname;
    client.capture('$pageview', { $current_url: window.location.href });
  }, [client, pathname]);

  return <PostHogContext.Provider value={client}>{children}</PostHogContext.Provider>;
}
PostHogProvider.displayName = 'PostHogProvider';
