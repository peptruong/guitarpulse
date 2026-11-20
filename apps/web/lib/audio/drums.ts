import type * as ToneType from 'tone';
import type { DrumInst } from '@guitarpulse/core/grooves';

type ToneLib = typeof ToneType;
type Disposable = { dispose(): unknown };

/** A synthesized kit: no samples to download, so tracks start instantly and work offline. */
export class DrumKit {
  private readonly hits: Record<DrumInst, (time: number, velocity: number) => void>;
  private readonly nodes: Disposable[] = [];

  constructor(T: ToneLib, out: ToneType.ToneAudioNode) {
    const keep = <N extends Disposable>(n: N) => {
      this.nodes.push(n);
      return n;
    };

    const kick = keep(new T.MembraneSynth({ pitchDecay: 0.045, octaves: 7, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.08 }, volume: -3 }));
    kick.connect(out);

    const snareBody = keep(new T.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, volume: -14 }));
    snareBody.connect(out);
    const snareHp = keep(new T.Filter(1400, 'highpass'));
    snareHp.connect(out);
    const snare = keep(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.02 }, volume: -11 }));
    snare.connect(snareHp);

    const hatHp = keep(new T.Filter(7000, 'highpass'));
    hatHp.connect(out);
    const hat = keep(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 }, volume: -19 }));
    hat.connect(hatHp);
    const openHat = keep(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 }, volume: -21 }));
    openHat.connect(hatHp);

    const ride = keep(new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.9, release: 0.3 }, harmonicity: 5.1, modulationIndex: 20, resonance: 5200, octaves: 1.2, volume: -30 }));
    ride.frequency.value = 330;
    ride.connect(out);

    const clapBp = keep(new T.Filter({ type: 'bandpass', frequency: 1300, Q: 1.2 }));
    clapBp.connect(out);
    const clap = keep(new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.03 }, volume: -10 }));
    clap.connect(clapBp);

    const rim = keep(new T.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.028, sustain: 0, release: 0.01 }, volume: -22 }));
    rim.connect(out);

    const tom = keep(new T.MembraneSynth({ pitchDecay: 0.06, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 }, volume: -10 }));
    tom.connect(out);

    const shakerHp = keep(new T.Filter(5200, 'highpass'));
    shakerHp.connect(out);
    const shaker = keep(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.006, decay: 0.05, sustain: 0, release: 0.02 }, volume: -24 }));
    shaker.connect(shakerHp);

    // Song lang (cải lương wooden clapper): a short, high, hollow knock.
    const clapper = keep(new T.MembraneSynth({ pitchDecay: 0.006, octaves: 1.5, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 }, volume: -8 }));
    clapper.connect(out);

    const gongLp = keep(new T.Filter(1800, 'lowpass'));
    gongLp.connect(out);
    const gong = keep(new T.MetalSynth({ envelope: { attack: 0.02, decay: 3.2, release: 2 }, harmonicity: 3.1, modulationIndex: 14, resonance: 900, octaves: 0.6, volume: -24 }));
    gong.frequency.value = 70;
    gong.connect(gongLp);

    this.hits = {
      kick: (t, v) => kick.triggerAttackRelease(48, 0.3, t, v),
      snare: (t, v) => {
        snare.triggerAttackRelease(0.15, t, v);
        snareBody.triggerAttackRelease(185, 0.1, t, v * 0.8);
      },
      hat: (t, v) => hat.triggerAttackRelease(0.04, t, v),
      openhat: (t, v) => openHat.triggerAttackRelease(0.3, t, v),
      ride: (t, v) => ride.triggerAttackRelease(330, 0.6, t, v),
      clap: (t, v) => clap.triggerAttackRelease(0.12, t, v),
      rim: (t, v) => rim.triggerAttackRelease(1750, 0.02, t, v),
      tom: (t, v) => tom.triggerAttackRelease(120, 0.25, t, v),
      shaker: (t, v) => shaker.triggerAttackRelease(0.05, t, v),
      clapper: (t, v) => clapper.triggerAttackRelease(1040, 0.06, t, v),
      gong: (t, v) => gong.triggerAttackRelease(70, 2.5, t, v),
    };
  }

  hit(inst: DrumInst, time: number, velocity: number) {
    this.hits[inst](time, Math.max(0.05, Math.min(1, velocity)));
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    this.nodes.length = 0;
  }
}
