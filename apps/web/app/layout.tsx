import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: { default: 'GuitarPulse', template: '%s · GuitarPulse' },
  description: 'Learn to improvise on guitar: backing tracks in every style, every scale on the neck, licks, a coach that listens, trading fours and ear training.',
  applicationName: 'GuitarPulse',
  // Static hosts can't send a Referrer-Policy header, so the page sets it.
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
