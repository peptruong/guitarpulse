import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Trade } from '@/features/Trade';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Trade fours', description: 'Trade four-bar phrases with GuitarPulse: it answers with your idea developed.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Trade />
    </Suspense>
  );
}
