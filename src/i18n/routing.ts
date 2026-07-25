import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'id'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
export type LocalePrefix = (typeof routing)['localePrefix'];
