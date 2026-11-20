/**
 * Copies the Signalsmith Stretch module (MIT) into public/vendor so the browser loads it as-is.
 * The library turns its own functions into an AudioWorklet module at runtime, so it must not be
 * rewritten by the app bundler.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('signalsmith-stretch'));
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vendor');
mkdirSync(outDir, { recursive: true });
copyFileSync(join(pkgDir, 'SignalsmithStretch.mjs'), join(outDir, `signalsmith-stretch-${version}.mjs`));
console.log(`Copied signalsmith-stretch ${version} to public/vendor`);
