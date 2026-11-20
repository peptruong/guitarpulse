/**
 * Synthesises guitar-like test audio (decaying harmonics, pick attacks, legato, bends, vibrato)
 * so the note tracker can be tested against notes we know exactly.
 */
export interface SynthNote {
  midi: number;
  start: number; // seconds
  dur: number; // seconds
  amp?: number;
  /** No new pick attack: continues the previous note's phase and decay (hammer-on / pull-off). */
  legato?: boolean;
  bend?: { semitones: number; at: number; over: number };
  vibrato?: { cents: number; rate: number };
}

const HARMONICS = [1, 0.55, 0.35, 0.25, 0.18, 0.12];

export function renderGuitar(notes: SynthNote[], sampleRate: number, totalSeconds: number, noiseDb = -75): Float32Array {
  const out = new Float32Array(Math.ceil(totalSeconds * sampleRate));
  let rng = 12345;
  const noiseAmp = 10 ** (noiseDb / 20);
  for (let i = 0; i < out.length; i++) {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    out[i] = ((rng / 0x7fffffff) * 2 - 1) * noiseAmp;
  }
  let phases = HARMONICS.map(() => 0);
  let envStart = 0;
  notes.forEach((n, idx) => {
    const amp = n.amp ?? 0.5;
    if (!n.legato) {
      phases = HARMONICS.map(() => 0);
      envStart = n.start;
    }
    const next = notes[idx + 1];
    const releaseLen = next?.legato ? 0 : 0.015;
    const s0 = Math.floor(n.start * sampleRate);
    const s1 = Math.min(out.length, Math.floor((n.start + n.dur + releaseLen) * sampleRate));
    for (let s = s0; s < s1; s++) {
      const t = s / sampleRate;
      const local = t - n.start;
      let semis = 0;
      if (n.bend && local > n.bend.at) semis += n.bend.semitones * Math.min(1, (local - n.bend.at) / n.bend.over);
      if (n.vibrato) semis += (n.vibrato.cents / 100) * Math.sin(2 * Math.PI * n.vibrato.rate * local);
      const f = 440 * 2 ** ((n.midi + semis - 69) / 12);
      const sinceEnv = t - envStart;
      const attack = Math.min(1, sinceEnv / 0.004);
      const decay = Math.exp(-sinceEnv / 0.9);
      const release = local > n.dur ? Math.max(0, 1 - (local - n.dur) / Math.max(releaseLen, 1e-6)) : 1;
      let v = 0;
      for (let h = 0; h < HARMONICS.length; h++) {
        phases[h] += (2 * Math.PI * f * (h + 1)) / sampleRate;
        v += HARMONICS[h] * Math.sin(phases[h]) * Math.exp(-sinceEnv * h * 0.8);
      }
      out[s] += amp * attack * decay * release * v * 0.5;
    }
  });
  return out;
}

/** Slides a frame window over the buffer like the AudioWorklet does; time = last sample of each frame. */
export function* frames(buffer: Float32Array, sampleRate: number, frameSize = 2048, hop = 512) {
  for (let end = frameSize; end <= buffer.length; end += hop) {
    yield { frame: buffer.slice(end - frameSize, end), time: end / sampleRate };
  }
}

/** Writes a 16-bit mono PCM WAV (used as Chrome's fake microphone in end-to-end tests). */
export function wavBytes(buffer: Float32Array, sampleRate: number): Uint8Array {
  const data = new DataView(new ArrayBuffer(44 + buffer.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + buffer.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, buffer.length * 2, true);
  for (let i = 0; i < buffer.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buffer[i])) * 0x7fff, true);
  return new Uint8Array(data.buffer);
}
