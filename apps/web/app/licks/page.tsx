import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Licks } from '@/features/Licks';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Licks', description: 'Original licks in the style of 63 players, with tab, playback and a lick mutator.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Licks />
    </Suspense>
  );
}
