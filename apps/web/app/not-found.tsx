import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-center">
      <div>
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">That page is out of tune</h1>
        <p className="mt-2 text-muted">It doesn’t exist. Pick up where you left off instead.</p>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink">
          Back to today
        </Link>
      </div>
    </div>
  );
}
