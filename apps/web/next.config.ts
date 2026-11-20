import type { NextConfig } from 'next';

// GitHub Pages serves the app from /<repo>/, and the deploy workflow passes that prefix in.
// Normalised the same way as lib/basePath.ts: '' or '/seg', with no trailing slash.
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');

const nextConfig: NextConfig = {
  // Plain files only: everything runs in the browser, so any static host can serve the app.
  output: 'export',
  basePath: base ? `/${base}` : '',
  // Each page becomes a folder (coach/index.html). Next also writes navigation data into coach/,
  // so without this a coach.html and a coach/ folder would compete for the same address.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets the dev server be opened from other devices on the home network (e.g. a phone).
  allowedDevOrigins: ['192.168.2.241'],
};

export default nextConfig;
