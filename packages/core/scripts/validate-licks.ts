import { LICKS } from '../src/licks/index.js';
import { validateAll } from './lick-validator.js';

const problems = validateAll(LICKS);
const artists = new Map<string, number>();
for (const l of LICKS) artists.set(l.artist, (artists.get(l.artist) ?? 0) + 1);
const thin = [...artists].filter(([, n]) => n < 2);

console.log(`${LICKS.length} licks from ${artists.size} artists checked.`);
for (const p of problems) console.log(`  ✗ ${p.id}: ${p.problem}`);
for (const [a, n] of thin) console.log(`  ✗ ${a} has only ${n} lick`);
if (problems.length || thin.length) process.exit(1);
console.log('  ✓ all licks parse, fit their bars and stay in their scales');
