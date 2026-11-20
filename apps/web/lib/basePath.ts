/**
 * The app can live under a sub-path, such as https://<user>.github.io/<repo>/ on GitHub Pages.
 * Next.js adds that prefix to <Link> and router calls by itself; these helpers add it to the URLs
 * the app builds by hand (share links and the time-stretcher module).
 */

/** '' for no prefix, otherwise '/seg' (or '/seg/seg') with no trailing slash. */
export function normalizeBase(raw: string | undefined): string {
  const inner = (raw ?? '').replace(/^\/+|\/+$/g, '');
  return inner ? `/${inner}` : '';
}

/** Set at build time by the deploy workflow; empty when running locally. */
export const BASE_PATH = normalizeBase(process.env.NEXT_PUBLIC_BASE_PATH);

/** Prefixes an app path that starts with '/'. */
export function withBase(path: string, base: string = BASE_PATH): string {
  return `${base}${path}`;
}

/** A full link to an app path, for sharing. */
export function absoluteUrl(origin: string, path: string, base: string = BASE_PATH): string {
  return `${origin}${withBase(path, base)}`;
}
