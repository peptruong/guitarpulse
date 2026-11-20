import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Song } from '@/features/Song';
import { PageLoading } from '@/components/PageLoading';

export const metadata: Metadata = { title: 'Song to practice', description: 'Type the chords of a song to get a backing track, a scale for every chord and the guide-tone line.' };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Song />
    </Suspense>
  );
}
