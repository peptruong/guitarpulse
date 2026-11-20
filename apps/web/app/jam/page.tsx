import type { Metadata } from 'next';
import { Suspense } from 'react';
import { JamLoader } from '@/features/JamLoader';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Jam', description: 'Open a jam session that Claude or a friend set up.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JamLoader />
    </Suspense>
  );
}
