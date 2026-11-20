import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Coach } from '@/features/Coach';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Coach', description: 'Improvise over a track while GuitarPulse listens, then get a report and a neck heatmap replay.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Coach />
    </Suspense>
  );
}
