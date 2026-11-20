import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Ear } from '@/features/Ear';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Ear trainer', description: 'Five-minute interval and chord-quality drills with spaced repetition.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Ear />
    </Suspense>
  );
}
