import type { Metadata } from 'next';
import { Path } from '@/features/Path';

export const metadata: Metadata = { title: 'Learning path', description: 'A week-by-week improvisation plan from your level, with tracks, licks and coach targets.' };

export default function Page() {
  return <Path />;
}
