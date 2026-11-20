import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Studio } from '@/features/Studio';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Backing tracks', description: 'Backing tracks in 24 styles, any key and tempo, with the scale and chord tones on the neck.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Studio />
    </Suspense>
  );
}
