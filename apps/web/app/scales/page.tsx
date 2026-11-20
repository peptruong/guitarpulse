import type { Metadata } from 'next';
import { Scales } from '@/features/Scales';

export const metadata: Metadata = { title: 'Scales and chords', description: 'Every scale on the whole neck in any tuning, plus CAGED, triad, shell and drop voicings.' };

export default function Page() {
  return <Scales />;
}
