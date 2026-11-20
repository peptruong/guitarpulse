import { makeLick as L, type Lick } from '../types.js';

/** Original style studies: funk, soul, neo-soul, pop, Latin, country and fingerstyle. */
const E9 = '(6.4 7.3 7.2 7.1)';
const MUTE = '(x.4 x.3 x.2 x.1)';
const chops = [E9, MUTE, E9, E9, MUTE, E9, MUTE, E9, E9, MUTE, E9, E9, MUTE, E9, E9, MUTE].join(' ');

export const GROOVE_COUNTRY: Lick[] = [
  L('rodgers-1', 'Nile Rodgers', 'funk', 'E9 sixteenth chops', {
    key: 'E', scale: 'mixolydian', chord: 'E9', bpm: 112, diff: 3, tech: ['rhythm', 'dead-notes', 'sixteenths'], targets: ['3', 'b7', '9'],
    theory: 'A small E9 shape (3rd, b7, 9th, 5th) chopped in sixteenths with muted strums between: the hand never stops moving.',
    tex: `:16 ${chops}`,
  }),
  L('rodgers-2', 'Nile Rodgers', 'funk', 'Ghost-note single-line groove', {
    key: 'E', scale: 'dorian', chord: 'Em7', bpm: 110, diff: 3, tech: ['dead-notes', 'sixteenths'], targets: ['1', '5'],
    theory: 'A single-note bass-like line with muted ghost strokes keeping the sixteenth-note pulse.',
    tex: ':16 7.5 x.5 7.5 9.4 x.4 7.4 9.4 x.4 7.3 x.3 9.3 x.3 7.4 9.4 x.4 7.5',
  }),
  L('mayfield-1', 'Curtis Mayfield', 'soul', 'Soul double-stop fill', {
    key: 'E', scale: 'major-pentatonic', chord: 'E', bpm: 92, diff: 2, tech: ['double-stop', 'slide', 'space'], targets: ['1', '3'],
    theory: 'Slides 2nd/5th into root/3rd, then the 6th/root: sweet major-pentatonic double stops answering a vocal line.',
    tex: '(11.3{sl} 12.2{sl}).8 (9.3 9.2).8 r.8 (6.3 5.2).8 (9.3 9.2).4 r.4',
  }),
  L('mayfield-2', 'Curtis Mayfield', 'soul', 'Sliding falsetto line', {
    key: 'E', scale: 'major-pentatonic', chord: 'E', bpm: 88, diff: 2, tech: ['slide', 'vibrato'], targets: ['1', '6'],
    theory: 'Slides up the B string through 3–5–6 to the root, then answers itself with 6–5.',
    tex: '9.2{sl}.8 12.2.8 14.2.8 12.1{v}.4 14.2.8 12.2.4',
  }),
  L('wong-1', 'Cory Wong', 'funk', 'Mixolydian scratch line', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 104, diff: 3, tech: ['dead-notes', 'sixteenths', 'rhythm'], targets: ['3', 'b7'],
    theory: 'Muted scratches between notes keep strict sixteenths; the line moves 3 → 4 → 5 → 6 → b7 → root.',
    tex: ':16 x.3 6.3 x.3 7.3 x.3 6.3 5.2 x.2 7.2 x.2 8.2 x.2 5.1 x.1 8.2 7.2',
  }),
  L('wong-2', 'Cory Wong', 'funk', 'Dyad stabs', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 104, diff: 3, tech: ['double-stop', 'syncopation', 'dead-notes'], targets: ['3', '5', 'b7'],
    theory: 'Two dyads (C#/E and D/G) syncopated against muted strums: the gaps are as important as the notes.',
    tex: ':16 (6.3 5.2) x.3 (6.3 5.2) r (7.3 8.2) x.3 (6.3 5.2) x.3 (6.3 5.2) (6.3 5.2) x.3 (7.3 8.2) r (6.3 5.2) x.3 (6.3 5.2)',
  }),
  L('asato-1', 'Mateus Asato', 'neo-soul', 'Fmaj9 to Em7 dyads', {
    key: 'C', scale: 'ionian', chord: 'Fmaj9 Em7', bpm: 76, diff: 4, tech: ['double-stop', 'hammer-on'], targets: ['3', '9'],
    theory: 'F/A and G/C dyads outline Fmaj9, an E → F hammer-on, then D/G and B/E for Em7: smooth neo-soul voice leading.',
    tex: '(10.3 10.2).8 (12.3 13.2).8 (10.3 10.2).8 9.3{h}.16 10.3.16 (12.4 12.3).4 (9.4 9.3).4',
  }),
  L('asato-2', 'Mateus Asato', 'neo-soul', 'Hammer-and-slide phrase', {
    key: 'E', scale: 'mixolydian', chord: 'E9', bpm: 80, diff: 3, tech: ['hammer-on', 'slide', 'vibrato'], targets: ['9', '3'],
    theory: 'A quick 5 → 6 hammer, root, then a slide 9 → 3 and back down to the 4th: relaxed, behind-the-beat phrasing.',
    tex: '12.2{h}.16 14.2.16 12.1.8 14.1{sl}.8 16.1.8 14.2.8 12.2.8 14.3{v}.4',
  }),
  L('sharkey-1', 'Isaiah Sharkey', 'neo-soul', 'Gospel b3 to 3 run', {
    key: 'C', scale: 'major-blues', chord: 'C', bpm: 84, diff: 4, tech: ['hammer-on', 'gospel run'], targets: ['3', '1'],
    theory: 'Hammers b3 → 3 (D# → E), then major-pentatonic notes G–A–C and back: the gospel major-blues sound.',
    tex: '4.2{h}.16 5.2.16 8.2.8 5.1.8 8.1.8 5.1.8 8.2.8 5.2{v}.4',
  }),
  L('sharkey-2', 'Isaiah Sharkey', 'neo-soul', 'Passing diminished', {
    key: 'C', scale: 'ionian', chord: 'C C#dim7 Dm7', bpm: 90, diff: 4, tech: ['arpeggio', 'chromatic'], targets: ['b3 of Dm7'], passing: ['b2', 'b7'],
    theory: 'A C#dim7 arpeggio (C#–E–G–Bb) between C and Dm7, resolving A–F–D: the classic gospel passing chord as a line.',
    tex: '6.3.8 5.2.8 8.2.8 6.1.8 5.1.8 6.2.8 3.2.4',
  }),
  L('misch-1', 'Tom Misch', 'neo-soul', 'Dm9 colour slide', {
    key: 'D', scale: 'dorian', chord: 'Dm9', bpm: 88, diff: 3, tech: ['slide', 'vibrato'], targets: ['9', '11', 'b3'],
    theory: '9th to 11th, then a slide down to the b3: upper colour tones of Dm9 before the root and b7.',
    tex: '12.1.8 15.1.8 15.1{sl}.8 13.1.8 10.1.4 13.2{v}.4',
  }),
  L('misch-2', 'Tom Misch', 'neo-soul', 'Lazy pentatonic phrase', {
    key: 'D', scale: 'dorian', chord: 'Dm7', bpm: 86, diff: 2, tech: ['vibrato', 'laid-back timing'], targets: ['1', '4'],
    theory: 'A short D minor pentatonic phrase meant to be played slightly behind the beat over a swung lo-fi groove.',
    tex: ':8 10.2 13.2 10.1.4 13.2.8 10.2.8 12.3{v}.4',
  }),
  L('faye-1', 'Melanie Faye', 'neo-soul', 'Ebmaj7 to Cm9 sweep', {
    key: 'Eb', scale: 'ionian', chord: 'Ebmaj7 Cm9', bpm: 90, diff: 4, tech: ['sweep', 'arpeggio', 'triplets'], targets: ['7', '1'],
    theory: 'Ebmaj7 swept up (Eb–G–Bb–D–G–Bb), then down through Eb–Bb–G–Eb to D and C: the same notes become Cm9.',
    tex: ':8 {tu 3} 6.5 5.4 3.3 3.2 3.1 6.1 4.2 3.3 5.4 1.4 5.5 3.5',
  }),
  L('faye-2', 'Melanie Faye', 'neo-soul', 'Clean hammer phrase', {
    key: 'Eb', scale: 'ionian', chord: 'Ebmaj7', bpm: 84, diff: 3, tech: ['hammer-on', 'vibrato'], targets: ['7', '1'],
    theory: 'Hammers from the major 7th (D) into the root (Eb) and floats over Ebmaj7 chord tones.',
    tex: '3.2{h}.16 4.2.16 3.1.8 6.1{v}.4 4.2.8 3.3.8 1.4{v}.4',
  }),
  L('mayer-1', 'John Mayer', 'pop', 'Major-pent double stops', {
    key: 'E', scale: 'major-pentatonic', chord: 'E', bpm: 92, diff: 3, tech: ['double-stop', 'bend', 'hybrid-picking'], targets: ['3', '6'],
    theory: 'Major-pentatonic double stops down the top two strings, then a bend from the root to the 2nd under a held 3rd.',
    tex: '(14.2 14.1).8 (12.2 12.1).8 (9.2 9.1).8 (12.2 12.1).8 (9.3{b (0 4)} 9.2).4 (9.3{v} 9.2{v}).4',
  }),
  L('mayer-2', 'John Mayer', 'pop', 'Bend, curl, resolve', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7', bpm: 96, diff: 3, tech: ['bend', 'curl', 'vibrato'], targets: ['1'],
    theory: 'A b7 → root bend, a quarter-tone curl on the b3 (between minor and major), and a fall to the 4th.',
    tex: '15.2{b (0 4)}.4 12.1.8 15.1{b (0 1)}.8 12.1.8 15.2.8 12.2.8 14.3{v}.8',
  }),
  L('prince-1', 'Prince', 'pop', 'Pentatonic run to a screaming bend', {
    key: 'E', scale: 'minor-pentatonic', chord: 'Em7', bpm: 112, diff: 3, tech: ['sixteenths', 'bend', 'vibrato'], targets: ['4', '5'],
    theory: 'A fast fall through box 1, then a long b3 → 4 bend held for two beats.',
    tex: ':16 15.1 12.1 15.2 12.2 14.3 12.3 14.4 12.4 15.1{b (0 4) v}.2',
  }),
  L('prince-2', 'Prince', 'pop', 'Climbing bends', {
    key: 'A', scale: 'dorian', chord: 'Am7', bpm: 108, diff: 3, tech: ['bend', 'repetition'], targets: ['5', '6'],
    theory: 'Bends to the 5th answered by the root, then bends to the 6th answered by the b3: the target rises each time.',
    tex: ':8 15.2{b (0 4)} 17.1 15.2{b (0 4)} 17.1 17.2{b (0 4)} 20.1 17.2{b (0 4)} 20.1',
  }),
  L('santana-1', 'Carlos Santana', 'latin', 'Sustained dorian sixth', {
    key: 'A', scale: 'dorian', chord: 'Am7', bpm: 92, diff: 2, tech: ['sustain', 'vibrato'], targets: ['6', '5'],
    theory: 'Holds F#, the dorian 6th, with vibrato before falling to the 5th: the note that makes minor sound hopeful.',
    tex: '10.2.8 12.2.8 14.1{v}.2 12.1{v}.4',
  }),
  L('santana-2', 'Carlos Santana', 'latin', 'Singing bend and turn', {
    key: 'A', scale: 'dorian', chord: 'Am7', bpm: 96, diff: 2, tech: ['bend', 'vibrato', 'turn'], targets: ['2', '1'],
    theory: 'A long root → 9th bend, then a little turn B–C–B and back to A.',
    tex: '14.3{b (0 4) v}.2 12.2.8 13.2.8 12.2.8 14.3.8',
  }),
  L('atkins-1', 'Chet Atkins', 'fingerstyle', 'Travis pattern in C', {
    key: 'C', scale: 'ionian', chord: 'C', bpm: 100, diff: 3, tech: ['travis-picking', 'fingerstyle'], targets: ['1', '3', '5'],
    theory: 'The thumb alternates C and E/G in the bass while the fingers play a melody on top: two parts at once.',
    tex: '(3.5 1.2).8 0.3.8 (2.4 0.1).8 1.2.8 (3.6 1.2).8 0.3.8 (2.4 3.1).8 1.2.8',
  }),
  L('atkins-2', 'Chet Atkins', 'fingerstyle', 'Rolling arpeggio', {
    key: 'C', scale: 'ionian', chord: 'C', bpm: 110, diff: 3, tech: ['fingerstyle', 'arpeggio'], targets: ['1', '3'],
    theory: 'A thumb-index-middle-ring roll over a C chord, alternating the bass between C and E.',
    tex: ':8 3.5 0.3 1.2 0.1 2.4 0.3 1.2 0.1',
  }),
  L('albert-lee-1', 'Albert Lee', 'country', 'Major-blues chicken pickin’', {
    key: 'A', scale: 'major-blues', chord: 'A', bpm: 132, diff: 4, tech: ['hybrid-picking', 'staccato', 'hammer-on'], targets: ['3', '1'],
    theory: 'b3 → 3 hammer, snappy staccato notes plucked with the fingers, and a 6–5–3–2–1 country ending.',
    tex: ':16 5.3{h} 6.3 5.2{st} 5.1{st} 7.2 5.2 6.3 4.3 7.4.2',
  }),
  L('albert-lee-2', 'Albert Lee', 'country', 'Pedal-steel bend', {
    key: 'A', scale: 'mixolydian', chord: 'A', bpm: 92, diff: 4, tech: ['bend', 'double-stop'], targets: ['3'],
    theory: 'Bends B up to C# under a held E and A, so the chord changes from Asus2-ish to A major like a pedal steel.',
    tex: '(4.3{b (0 4)} 5.2 5.1).2 (6.3 5.2 5.1).4 r.4',
  }),
  L('mason-1', 'Brent Mason', 'country', 'Bend under a held note', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 120, diff: 4, tech: ['bend', 'release', 'double-stop'], targets: ['6', '1'],
    theory: 'Bends D → E on the G string while the G on the B string holds, releases, then walks down C/E – B – G.',
    tex: '(7.3{b (0 4)} 8.2).4 (7.3{b (4 0)} 8.2).4 (5.3 5.2).8 4.3.8 5.4.4',
  }),
  L('mason-2', 'Brent Mason', 'country', 'Sixths run', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 130, diff: 4, tech: ['sixths', 'hybrid-picking'], targets: ['1', '6'],
    theory: 'Diatonic sixths on the G and high E strings, descending then turning back up: the sweetest country interval.',
    tex: '(12.3 12.1).8 (11.3 10.1).8 (9.3 8.1).8 (7.3 7.1).8 (5.3 5.1).8 (4.3 3.1).8 (5.3 5.1).8 (7.3 7.1).8',
  }),
  L('paisley-1', 'Brad Paisley', 'country', 'Open-string chromatic run', {
    key: 'E', scale: 'mixolydian', chord: 'E', bpm: 140, diff: 4, tech: ['chromatic', 'open strings', 'sixteenths'], targets: ['1'], passing: ['b3', 'b6'],
    theory: 'Chromatic notes walk down each string into an open string, so the run sounds fast while the left hand barely moves.',
    tex: ':16 4.1 3.1 2.1 0.1 3.2 2.2 1.2 0.2 2.3 1.3 0.3 4.4 2.4{v}.4',
  }),
  L('paisley-2', 'Brad Paisley', 'country', 'Banjo roll', {
    key: 'E', scale: 'mixolydian', chord: 'E', bpm: 120, diff: 3, tech: ['hybrid-picking', 'roll', 'open strings'], targets: ['4', '5'],
    theory: 'A fretted note rolled with two open strings in a repeating three-note pattern, like a banjo roll.',
    tex: ':16 2.3 0.2 0.1 2.3 0.2 0.1 2.3 0.2 4.3 0.2 0.1 4.3 0.2 0.1 4.3 0.2',
  }),
  L('gatton-1', 'Danny Gatton', 'country', 'Bebop line over A7', {
    key: 'A', scale: 'bebop-dominant', chord: 'A7', bpm: 180, diff: 5, tech: ['bebop scale', 'eighth notes'], targets: ['1', '3', '5', 'b7'],
    theory: 'A7 bebop scale from the root down: the passing G# keeps A, G, E and C# (all chord tones) on the downbeats.',
    tex: ':8 17.1 16.1 15.1 14.1 17.2 15.2 14.2 16.3 | 14.3{v}.2 r.2',
  }),
  L('gatton-2', 'Danny Gatton', 'country', 'Steel-guitar bends', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 110, diff: 4, tech: ['bend', 'release', 'double-stop'], targets: ['5', '3'],
    theory: 'Bends the 4th up to the 5th under a held root, releases, then resolves to C#/E and A/C#.',
    tex: '(7.3{b (0 4)} 10.2).4 (7.3{b (4 0)} 10.2).4 (6.3 5.2).4 (7.4 6.3).4',
  }),
  L('emmanuel-1', 'Tommy Emmanuel', 'fingerstyle', 'Travis bass with melody', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 110, diff: 4, tech: ['travis-picking', 'fingerstyle'], targets: ['1', '5'],
    theory: 'Thumb alternates G and D in the bass with an open G between, while the melody walks G–D–B–A on top.',
    tex: '(3.6 3.1).8 0.3.8 (0.4 3.2).8 0.3.8 (3.6 7.1).8 0.3.8 (0.4 5.1).8 0.3.8',
  }),
  L('emmanuel-2', 'Tommy Emmanuel', 'fingerstyle', 'Harmonic cascade', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 96, diff: 3, tech: ['harmonics', 'open strings'], targets: ['1', '3'],
    theory: 'Harmonics alternate with open strings so neighbouring notes overlap like a harp.',
    tex: '12.3{nh}.8 0.2.8 12.2{nh}.8 0.1.8 12.1{nh}.8 0.3.8 7.4{nh}.4',
  }),
];
