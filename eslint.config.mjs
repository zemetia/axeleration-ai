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
];

export default eslintConfig;
