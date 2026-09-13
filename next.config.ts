import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },

  // Heavy Node-only packages. Without this Next traces and bundles them into the
  // server output on every compile — on a slow disk that trace is minutes of IO for
  // code that only ever runs in Node. `require` them at runtime instead.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
    'bcryptjs',
    'playwright-core',
    'fluent-ffmpeg',
    'langchain',
    '@langchain/core',
    '@langchain/anthropic',
    '@langchain/openai',
    '@langchain/langgraph',
    '@langchain/langgraph-checkpoint-postgres',
    '@langchain/mcp-adapters',
    '@modelcontextprotocol/sdk',
    '@google/genai',
    '@elevenlabs/elevenlabs-js',
    '@fal-ai/client',
    'replicate',
    'inngest',
  ],

  /**
   * Generated media lives in `LOCAL_STORAGE_DIR` (./storage), not `public/` — the files are written
   * at runtime by provider adapters, so they cannot be part of the build output, and `storage.ts`
   * path-checks every key before touching the disk. It is served by the route handler at
   * `src/app/api/media/[...path]/route.ts`.
   *
   * The rewrite exists because `LOCAL_STORAGE_PUBLIC_BASE_URL` ends in `/media` while the handler
   * lives under `/api/media`, so every stored URL 404'd. Rewriting is the fix rather than changing
   * the env var: the `/media/...` form is already persisted in `Asset.refUrl` and in shot records,
   * and those rows would stay broken.
   */
  async rewrites() {
    return [{ source: '/media/:path*', destination: '/api/media/:path*' }];
  },

  experimental: {
    // `lucide-react` is a barrel: one `import { Button }` pulls the whole package through
    // the compiler. Rewriting them to deep imports is the single biggest dev-compile win
    // in this app.
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
};

// The Sentry build plugin (source-map upload, `reactComponentAnnotation`, tree-shake
// pass) adds a transform over every component and a post-build step. In dev it buys
// nothing — sourcemaps are already disabled below and there is nothing to upload — so
// only pay for it in production builds.
export default isProd
  ? withSentryConfig(nextConfig, {
      org: process.env['SENTRY_ORG'],
      project: process.env['SENTRY_PROJECT'],
      // Suppress non-error output unless in CI
      silent: !process.env['CI'],
      widenClientFileUpload: true,
      webpack: {
        reactComponentAnnotation: { enabled: true },
        treeshake: { removeDebugLogging: true },
      },
      // Proxy Sentry requests through Next.js to avoid ad-blockers
      tunnelRoute: '/monitoring',
      sourcemaps: { disable: false },
    })
  : nextConfig;
