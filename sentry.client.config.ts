import * as Sentry from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: isProd ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined,
  enabled: isProd,
  environment: process.env.NODE_ENV,
  tracesSampleRate: isProd ? 0.1 : 0,
  // Session Replay records the DOM continuously through a MutationObserver — it is the
  // heaviest thing the browser SDK does (~50KB of extra JS plus real main-thread cost on
  // every interaction). Keep it out of the first-paint path: production only, attached
  // lazily once the browser is idle. Errors are still captured from the very first byte.
  replaysSessionSampleRate: isProd ? 0.1 : 0,
  replaysOnErrorSampleRate: isProd ? 1.0 : 0,
  integrations: [],
  debug: false,
});

if (isProd && typeof window !== 'undefined') {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 3000));
  idle(() => {
    void import('@sentry/nextjs').then((mod) => {
      Sentry.addIntegration(mod.replayIntegration());
    });
  });
}
