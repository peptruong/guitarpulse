'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Ear, GraduationCap, Grid3x3, Guitar, House, ListMusic, Menu, Mic, Music, Repeat2, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';
import { useAudio } from './Providers';
import { cx } from './ui';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Today', short: 'Today', icon: House },
  { href: '/studio', label: 'Backing tracks', short: 'Studio', icon: Music },
  { href: '/coach', label: 'Coach', short: 'Coach', icon: Mic },
  { href: '/trade', label: 'Trade fours', short: 'Trade', icon: Repeat2 },
  { href: '/song', label: 'Song to practice', short: 'Song', icon: ListMusic },
  { href: '/licks', label: 'Licks', short: 'Licks', icon: Guitar },
  { href: '/ear', label: 'Ear trainer', short: 'Ear', icon: Ear },
  { href: '/scales', label: 'Scales & chords', short: 'Scales', icon: Grid3x3 },
  { href: '/path', label: 'Learning path', short: 'Path', icon: GraduationCap },
];
const PRIMARY_MOBILE = ['/', '/studio', '/coach', '/licks'];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  // Each logo needs its own gradient id: the sidebar copy is hidden on phones, and a gradient
  // inside a hidden element does not paint for the visible copy.
  const gradient = `gp-logo-${useId().replace(/:/g, '')}`;
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="GuitarPulse home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#0f172a" stroke={`url(#${gradient})`} strokeWidth="1.5" />
        <path d="M5 17h5l2.5-7 4 13 3-9 2 3H27" fill="none" stroke={`url(#${gradient})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && <span className="text-[1.05rem] font-semibold tracking-tight text-ink">GuitarPulse</span>}
    </Link>
  );
}

function AudioChip() {
  const { status, ensure, engine } = useAudio();
  const running = status === 'running';
  if (!engine || running) {
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', running ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-line bg-white/5 text-muted')} title={running ? 'Audio is running' : 'Sound starts when you press Play'}>
        {running ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
        {running ? 'Sound on' : 'Sound off'}
      </span>
    );
  }
  return (
    <button type="button" onClick={() => void ensure()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-warm/40 bg-warm/10 px-2.5 py-1 text-xs text-amber-200 hover:bg-warm/20">
      <VolumeX className="h-3.5 w-3.5" aria-hidden />
      Sound paused: tap to resume
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [moreOpen, setMoreOpen] = useState(false);
  const firstMoreLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    firstMoreLink.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg/70 px-3 py-5 backdrop-blur-xl lg:flex" aria-label="Main">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-7 flex flex-col gap-0.5" aria-label="Sections">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active ? 'bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgb(34_211_238/0.25)]' : 'text-muted hover:bg-white/5 hover:text-ink')}
              >
                <Icon className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-xs leading-relaxed text-faint">
          <p>Everything you play stays on this device.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/75 px-4 backdrop-blur-xl lg:ml-60 lg:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <p className="hidden text-sm text-muted lg:block">{NAV.find((n) => isActive(pathname, n.href))?.label ?? 'GuitarPulse'}</p>
        <AudioChip />
      </header>

      <main id="main" className="px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-8 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Sections">
        {moreOpen && (
          <div className="absolute inset-x-3 bottom-full mb-2 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface/95 p-2 shadow-2xl backdrop-blur-xl" role="menu" aria-label="More sections">
            {NAV.filter((n) => !PRIMARY_MOBILE.includes(n.href)).map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} ref={i === 0 ? firstMoreLink : undefined} role="menuitem" href={item.href} className={cx('flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm', isActive(pathname, item.href) ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-white/5')}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
        <div className="grid h-16 grid-cols-5">
          {NAV.filter((n) => PRIMARY_MOBILE.includes(n.href)).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cx('flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium', active ? 'text-accent' : 'text-muted')}>
                <Icon className="h-5 w-5" aria-hidden />
                {item.short}
              </Link>
            );
          })}
          <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((v) => !v)} className={cx('flex cursor-pointer flex-col items-center justify-center gap-1 text-[0.7rem] font-medium', moreOpen || NAV.some((n) => !PRIMARY_MOBILE.includes(n.href) && isActive(pathname, n.href)) ? 'text-accent' : 'text-muted')}>
            {moreOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

