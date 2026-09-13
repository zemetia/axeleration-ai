import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';

import { Toaster } from '@/components/ui/Sonner';
import { PostHogProvider, QueryProvider } from '@/providers';

import './globals.css';

// Both faces are variable fonts on Google Fonts. Listing explicit `weight`s opts out of
// that and pulls one static file per weight — this was 6 + 3 = 9 separate font downloads,
// each a render-blocking preload. Omitting `weight` ships one variable file per family
// that covers the whole range.
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false, // mono is only used inside code/meta blocks, not on the first-paint path
});

export const metadata: Metadata = {
  title: {
    template: '%s | Axeleration AI',
    default: 'Axeleration AI',
  },
  description: 'A strict, production-ready Next.js 16 template',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${outfit.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <QueryProvider>
          <PostHogProvider>{children}</PostHogProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
