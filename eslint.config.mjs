import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('eslint').Linter.FlatConfig[]} */
const nextConfig = require('eslint-config-next/core-web-vitals');

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  ...nextConfig,
  {
    settings: {
      react: { version: '19' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Server Action modules are imported by the client components that call them, so the
    // bundler walks their entire static import graph even though the code only ever runs on
    // the server. Statically importing the AI stack here once dragged LangChain, every
    // provider SDK and `fluent-ffmpeg` into the dashboard's graph and left pages stuck on a
    // loading skeleton. Load these with `await import()` inside the action that needs them.
    // See docs/knowledge/LEARN.md, 2026-07-29.
    files: ['src/app/**/actions.ts', 'src/app/**/actions.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/ai', '@/ai/*', '@/inngest', '@/inngest/*', '@/mcp', '@/mcp/*', '@/providers/register'],
              message:
                'Server Action files are in the client module graph. Import this lazily inside the action body — `const { x } = await import(...)` — instead of at module scope.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
