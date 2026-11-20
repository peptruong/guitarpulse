'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getGroove } from '@guitarpulse/core/grooves';
import { getLick } from '@guitarpulse/core/licks/index';
import { decodeJam, describeJam } from '@guitarpulse/core/session';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';
import { PAGE_FOR_MODE } from '@/lib/settings';

export function JamLoader() {
  const params = useSearchParams();
  const code = params.get('s');
  const result = useMemo(() => (code ? decodeJam(code) : null), [code]);

  if (!code || !result) {
    return (
      <>
        <PageHeader eyebrow="Jam link" title="No jam in this link" description="Jam links come from Claude (ask it to set up a jam with the GuitarPulse connector) or from the Share button on a track." />
        <Link href="/studio" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
          Open backing tracks <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </>
    );
  }
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Jam link" title="This jam link doesn’t work" />
        <Notice tone="error">{result.error}</Notice>
        <Link href="/studio" className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-line px-5 text-sm text-ink">
          Set one up by hand <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </>
    );
  }
  const s = result.session;
  const groove = s.groove ? getGroove(s.groove) : null;
  const target = `${PAGE_FOR_MODE[s.mode]}?s=${code}`;
  return (
    <>
      <PageHeader eyebrow="Jam ready" title={s.title ?? describeJam(s)} description={s.title ? describeJam(s) : undefined} />
      <Card className="max-w-2xl">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{s.mode === 'trade' ? 'Trade fours' : s.mode === 'ear' ? 'Ear training' : s.mode === 'song' ? 'Song practice' : s.mode === 'coach' ? 'Coached jam' : 'Backing track'}</Badge>
            {groove && <Badge>{groove.name}</Badge>}
            {s.key && <Badge>key {s.key}</Badge>}
            {s.bpm && <Badge>{s.bpm} BPM</Badge>}
          </div>
          {s.focus && (
            <p className="flex gap-2 text-base text-ink">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
              {s.focus}
            </p>
          )}
          {s.note && <p className="text-sm text-muted">{s.note}</p>}
          {s.chart && <pre className="overflow-x-auto rounded-xl border border-line bg-surface/70 p-3 font-mono text-sm text-ink">{s.chart}</pre>}
          {s.licks && s.licks.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {s.licks.map((id) => (
                <li key={id}>
                  <Link href={`/licks?id=${encodeURIComponent(id)}`} className="rounded-lg border border-line px-2 py-1 text-sm text-ink hover:border-accent/50">
                    {getLick(id)?.title ?? id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={target} className="inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-accent px-6 text-base font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(34_211_238/0.6)]">
            Open and play <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Card>
    </>
  );
}
