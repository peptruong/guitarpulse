import { makeLick as L, type Lick } from '../types.js';

/** Original style studies: shred, prog and modern players, then jazz and fusion. */
export const MODERN_JAZZ: Lick[] = [
  // ── Shred, prog and modern ──────────────────────────────────────────────
  L('yngwie-1', 'Yngwie Malmsteen', 'shred', 'Harmonic-minor sextuplets', {
    key: 'E', scale: 'harmonic-minor', chord: 'B7', bpm: 132, diff: 5, tech: ['sextuplets', 'alternate picking', 'sequence'], targets: ['7', '1'],
    theory: 'A six-note E harmonic minor cell that shifts down one note each beat; the D# leading tone resolves to E at the end.',
    tex: ':16 {tu 3} 12.1 11.1 8.1 12.2 10.2 8.2 11.1 8.1 12.2 10.2 8.2 11.3 8.1 12.2 10.2 8.2 11.3 9.3 12.2 10.2 8.2 11.3 9.3 8.3 | :2 9.3{v} r',
  }),
  L('yngwie-2', 'Yngwie Malmsteen', 'shred', 'Pedal-point arpeggio', {
    key: 'A', scale: 'harmonic-minor', chord: 'E7', bpm: 120, diff: 4, tech: ['pedal point', 'sixteenths'], targets: ['1', '7'],
    theory: 'Every other note returns to a high A (the pedal) while the other voice moves F → E → G#, outlining Am and E7.',
    tex: ':16 17.1 13.1 17.1 12.1 17.1 13.1 17.1 16.1 17.1 13.1 17.1 12.1 17.1 13.1 16.1 17.1',
  }),
  L('gilbert-1', 'Paul Gilbert', 'shred', 'String-skip pentatonic', {
    key: 'A', scale: 'minor-pentatonic', chord: 'Am', bpm: 140, diff: 4, tech: ['string-skipping', 'sixteenths'], targets: ['1'],
    theory: 'Pairs on the G string answered by pairs on the high E (skipping the B string), so a plain box sounds wide and fresh.',
    tex: ':16 5.3 7.3 5.1 8.1 7.3 5.3 5.1 8.1 5.4 7.4 5.2 8.2 7.4 5.4 5.2 8.2',
  }),
  L('gilbert-2', 'Paul Gilbert', 'shred', 'Octave skip ladder', {
    key: 'A', scale: 'minor-pentatonic', chord: 'Am', bpm: 130, diff: 4, tech: ['string-skipping', 'octaves', 'sixteenths'], targets: ['1', '5'],
    theory: 'Each pentatonic note followed by its octave two strings up: climb A–C–D–E, then mirror it back down.',
    tex: ':16 7.4 10.2 10.4 13.2 12.4 15.2 14.4 17.2 17.2 14.4 15.2 12.4 13.2 10.4 10.2 7.4',
  }),
  L('vai-1', 'Steve Vai', 'shred', 'Lydian #11 scoop', {
    key: 'E', scale: 'lydian', chord: 'Emaj7#11', bpm: 76, diff: 4, tech: ['slide in', 'vibrato', 'space'], targets: ['#4', '5'],
    theory: 'Climbs 7 → 2 → 3 and scoops into A#, the #11 that defines Lydian, before resolving to the 5th.',
    tex: '16.2.8 14.1.8 16.1.8 18.1{sib v}.4 r.8 19.1{v}.4',
  }),
  L('vai-2', 'Steve Vai', 'shred', 'Wide-stretch legato', {
    key: 'E', scale: 'lydian', chord: 'Emaj7', bpm: 120, diff: 4, tech: ['legato', 'triplets', 'stretch'], targets: ['3', '7'],
    theory: 'Hammer-ons up and pull-offs down across wide stretches (D#–F#–G#, B–C#–D#): only the first note of each group is picked.',
    tex: ':8 {tu 3} 11.1{h} 14.1{h} 16.1 16.1{h} 14.1{h} 11.1 12.2{h} 14.2{h} 16.2 16.2{h} 14.2{h} 12.2',
  }),
  L('satriani-1', 'Joe Satriani', 'shred', 'Pitch-axis switch', {
    key: 'E', scale: 'lydian', chord: 'E5 pedal', bpm: 112, diff: 4, tech: ['modes', 'pitch axis'], targets: ['#4', '4'], passing: ['4', 'b7'],
    theory: 'Same root, two modes: bar 1 is E Lydian (A#), bar 2 is E Mixolydian (A and D). Hear how one note changes the mood.',
    tex: ':8 12.1 14.1 16.1 18.1 16.1 14.1 12.1.4 | :8 12.1 14.1 16.1 17.1 16.1 14.1 15.2.4',
  }),
  L('satriani-2', 'Joe Satriani', 'shred', 'Three-note-per-string legato', {
    key: 'E', scale: 'aeolian', chord: 'Em', bpm: 118, diff: 4, tech: ['legato', '3nps', 'sixteenths'], targets: ['4'],
    theory: 'Three notes per string, picking only the first of each: smooth and even, up through E natural minor and back.',
    tex: ':16 12.2{h} 13.2{h} 15.2 12.1{h} 14.1{h} 15.1 17.1{h} 15.1{h} 14.1 15.2{h} 13.2{h} 12.2 14.3{v}.4',
  }),
  L('petrucci-1', 'John Petrucci', 'prog', '3NPS sextuplets', {
    key: 'E', scale: 'aeolian', chord: 'Em', bpm: 132, diff: 5, tech: ['alternate picking', '3nps', 'sextuplets'], targets: ['1'],
    theory: 'An alternate-picked three-note-per-string run up the G, B and high E strings and back down, landing on the root on beat 4.',
    tex: ':16 {tu 3} 12.3 14.3 16.3 13.2 15.2 17.2 14.1 15.1 17.1 15.1 14.1 17.2 15.2 13.2 16.3 14.3 12.3 16.4 :4 14.4{v}',
  }),
  L('petrucci-2', 'John Petrucci', 'prog', 'Groups of five', {
    key: 'E', scale: 'aeolian', chord: 'Em', bpm: 120, diff: 4, tech: ['odd grouping', 'accents', 'sixteenths'], targets: ['1'],
    theory: 'Five-note groups in straight sixteenths, so the accent moves across the beat: a prog trick that needs no odd meter.',
    tex: ':16 12.3{ac} 14.3 16.3 13.2 15.2 14.3{ac} 16.3 13.2 15.2 17.2 16.3{ac} 13.2 15.2 17.2 14.1 r',
  }),
  L('govan-1', 'Guthrie Govan', 'fusion', 'Chromatic approach notes', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 116, diff: 5, tech: ['chromatic', 'sixteenths', 'legato'], targets: ['1', '3', '5', 'b7'], passing: ['7', 'b3', '#4'],
    theory: 'Every chord tone of A7 (A, C#, E, G) is approached from a half step below, so the outside notes always resolve.',
    tex: ':16 13.3 14.3 13.2 14.2 16.2 17.2 14.1 15.1 17.1{v}.2',
  }),
  L('govan-2', 'Guthrie Govan', 'fusion', 'Hybrid-picked sixths', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 100, diff: 4, tech: ['hybrid-picking', 'sixths', 'slide'], targets: ['1', '3'],
    theory: 'Sixths on the G and high E strings walking down A Mixolydian: pick the G string, pluck the E string with a finger.',
    tex: '(14.3 14.1).8 (12.3 12.1).8 (11.3 10.1).8 (9.3 9.1).8 (11.3 10.1).8 (9.3{sl} 9.1{sl}).8 (7.3 7.1).4',
  }),
  L('abasi-1', 'Tosin Abasi', 'prog', 'Thump-and-pluck in 7/8', {
    key: 'F#', scale: 'aeolian', chord: 'F#m', bpm: 110, diff: 5, tech: ['thumping', 'slap', 'odd meter'], targets: ['1'], ts: [7, 8],
    theory: 'Thumb strikes on the low string answered by plucked octaves, in groups that fill one bar of 7/8.',
    tex: ':16 2.6 {s} 2.6 {s} 4.4 {p} 2.6 {s} 5.6 {s} 4.4 {p} 2.6 {s} 2.6 {s} 4.4 {p} 2.6 {s} 4.6 {s} 2.4 {p} 4.5 {s} 2.6 {s}',
  }),
  L('abasi-2', 'Tosin Abasi', 'prog', 'Tapped wide arpeggio', {
    key: 'F#', scale: 'aeolian', chord: 'F#m(add9)', bpm: 120, diff: 5, tech: ['tapping', 'legato', 'triplets'], targets: ['1', '5', '9'],
    theory: 'Tap, pull, pull on the G string (F#–C#–A) and the B string (C#–G#–E): a wide F#m(add9) sound from two strings.',
    tex: '11.3{h}.8 {tu 3 tt} 6.3{h}.8 {tu 3} 2.3.8 {tu 3} 14.2{h}.8 {tu 3 tt} 9.2{h}.8 {tu 3} 5.2.8 {tu 3} 11.3{h}.8 {tu 3 tt} 6.3{h}.8 {tu 3} 2.3.8 {tu 3} 14.2{h}.8 {tu 3 tt} 9.2{h}.8 {tu 3} 5.2.8 {tu 3}',
  }),
  L('polyphia-1', 'Tim Henson & Scott LePage', 'prog', 'Tapped maj7 arpeggio', {
    key: 'C', scale: 'lydian', chord: 'Cmaj7', bpm: 92, diff: 5, tech: ['tapping', 'hybrid-picking', 'arpeggio'], targets: ['7', '#4'],
    theory: 'Cmaj7 arpeggio across four strings with a tapped 3rd, then again from the 7th with a tapped #11 (F#) for a Lydian lift.',
    tex: ':16 10.4 9.3 8.2 7.1 12.1 {tt} 7.1 8.2 9.3 9.4 9.3 8.2 7.1 14.1 {tt} 7.1 8.2 9.3',
  }),
  L('polyphia-2', 'Tim Henson & Scott LePage', 'prog', 'Ghost-note groove', {
    key: 'E', scale: 'aeolian', chord: 'Em9', bpm: 90, diff: 4, tech: ['dead-notes', 'syncopation', 'hybrid-picking'], targets: ['1', '9'],
    theory: 'Notes alternate with muted "ghost" strokes so the line grooves like a drum part; it lands on the 9th (F#) and root.',
    tex: ':16 5.3 x.3 7.3 x.3 5.2 x.2 8.1 r 7.1 x.1 5.1 x.1 7.2.8 5.2.8',
  }),
  L('plini-1', 'Plini', 'prog', 'Lydian ninth resolve', {
    key: 'E', scale: 'lydian', chord: 'Emaj9', bpm: 84, diff: 3, tech: ['legato', 'slide', 'vibrato'], targets: ['9', '#4', '5'],
    theory: 'The 9th hammers to the 3rd, slides into the #11 and resolves to the 5th: airy and unresolved until the last note.',
    tex: '14.1{h}.8 16.1.8 18.1{sl}.4 19.1{v}.2',
  }),
  L('plini-2', 'Plini', 'prog', 'Open-string shimmer', {
    key: 'E', scale: 'lydian', chord: 'Emaj7#11', bpm: 96, diff: 3, tech: ['let ring', 'open strings'], targets: ['3', '#4', '9'],
    theory: 'The open high E rings under a moving melody on the B string (G#–A#–B–F#), creating clean, chiming intervals.',
    tex: '0.1{lr}.8 9.2.8 0.1{lr}.8 11.2.8 0.1{lr}.8 12.2.8 7.2{v}.4',
  }),
  L('ichika-1', 'Ichika Nito', 'prog', 'Harmonic bloom', {
    key: 'G', scale: 'ionian', chord: 'Gmaj9', bpm: 80, diff: 3, tech: ['harmonics', 'let ring'], targets: ['9', '7'],
    theory: 'Natural harmonics at frets 12 and 7 spell D–G–B–D–F#–E: a Gmaj9 sound made only of bell tones.',
    tex: '12.4{nh}.8 12.3{nh}.8 12.2{nh}.8 7.3{nh}.8 7.2{nh}.4 12.1{nh}.4',
  }),
  L('ichika-2', 'Ichika Nito', 'prog', 'Chord-melody slide', {
    key: 'D', scale: 'ionian', chord: 'Dmaj9', bpm: 76, diff: 4, tech: ['chord-melody', 'slide'], targets: ['9', '3'],
    theory: 'Three-note shapes slide from F#–C#–E up to A–E–F#, then settle on a four-note D major chord with A on top.',
    tex: '(4.4{sl} 6.3{sl} 5.2{sl}).4 (7.4 9.3 7.2).4 (7.4 7.3 7.2 5.1).2',
  }),

  // ── Jazz and fusion ─────────────────────────────────────────────────────
  L('christian-1', 'Charlie Christian', 'jazz', 'Swing arpeggio with chromatic fall', {
    key: 'F', scale: 'bebop-dominant', chord: 'F7', bpm: 150, diff: 3, tech: ['arpeggio', 'chromatic', 'swing'], targets: ['3', 'b7'],
    theory: 'Climbs the F7 arpeggio (F–A–C–Eb), then falls chromatically F–E–Eb–D and lands on A, the 3rd.',
    tex: ':8 3.4 7.4 5.3 8.3 6.2 5.2 4.2 3.2 | 2.3.2 r.2',
  }),
  L('christian-2', 'Charlie Christian', 'jazz', 'Riff with a blue curl', {
    key: 'F', scale: 'minor-blues', chord: 'F7', bpm: 140, diff: 2, tech: ['bend', 'riff', 'swing'], targets: ['3', '1'], passing: ['3'],
    theory: 'A short repeated riff; the b3 (Ab) is bent a half step toward A, the 3rd of F7, for the blues "in-between" pitch.',
    tex: ':8 16.1{b (0 2)} 13.1 16.2 13.2 16.1{b (0 2)} 13.1 15.3.4',
  }),
  L('django-1', 'Django Reinhardt', 'gypsy-jazz', 'Minor-6 arpeggio sweep', {
    key: 'A', scale: 'melodic-minor', chord: 'Am6', bpm: 180, diff: 4, tech: ['arpeggio', 'sweep', 'triplets'], targets: ['6', '1'],
    theory: 'An Am6 arpeggio (A–C–E–F#) swept up and down in triplets: the major 6th (F#) is the gypsy-jazz sound.',
    tex: ':8 {tu 3} 12.5 10.4 9.3 7.2 8.1 5.1 8.1 7.2 9.3 10.4 9.3 7.4',
  }),
  L('django-2', 'Django Reinhardt', 'gypsy-jazz', 'Diminished passing run', {
    key: 'A', scale: 'harmonic-minor', chord: 'E7', bpm: 170, diff: 4, tech: ['arpeggio', 'sixteenths'], targets: ['5'],
    theory: 'G# diminished (G#–B–D–F) over E7 is E7b9 without its root; it climbs two octaves and lands on E.',
    tex: ':16 6.4 9.4 7.3 10.3 9.2 12.2 10.1 13.1 12.1{v}.2',
  }),
  L('wes-1', 'Wes Montgomery', 'jazz', 'Thumb octaves', {
    key: 'Bb', scale: 'dorian', chord: 'Bb7', bpm: 120, diff: 3, tech: ['octaves', 'thumb', 'slide'], targets: ['1', 'b3'],
    theory: 'A bluesy melody in octaves (strings 4 and 2, mute the G string); the Db is the blue b3 against Bb7.',
    tex: '(8.4 11.2).8 (6.4 9.2).8 (8.4 11.2).4 (10.4 13.2).8 (11.4{sl} 14.2{sl}).8 (10.4 13.2).4 | (8.4 11.2).2 r.2',
  }),
  L('wes-2', 'Wes Montgomery', 'jazz', 'Block-chord answer', {
    key: 'Bb', scale: 'mixolydian', chord: 'Bb7', bpm: 140, diff: 4, tech: ['block chords', 'syncopation'], targets: ['1', '9'],
    theory: 'Two four-note voicings, Bb7 and Bb9, used as a call and response; the melody note on top moves Bb → C.',
    tex: '(6.4 7.3 6.2 6.1).8 (8.4 7.3 9.2 8.1).8 r.8 (6.4 7.3 6.2 6.1).8 r.4 (8.4 7.3 9.2 8.1).4',
  }),
  L('pass-1', 'Joe Pass', 'jazz', 'Walking bass with shells', {
    key: 'G', scale: 'ionian', chord: 'Am7 D7 Gmaj7', bpm: 110, diff: 4, tech: ['shell voicings', 'walking bass'], targets: ['3', '7'],
    theory: 'Root–3rd–7th shells on beats 1 and 3, passing bass notes in between: a ii–V–I that walks on its own.',
    tex: '(5.6 5.4 5.3).4 7.6.4 (5.5 4.4 5.3).4 2.6.4 | (3.6 4.4 4.3).2 r.2',
  }),
  L('pass-2', 'Joe Pass', 'jazz', 'ii–V–I line', {
    key: 'C', scale: 'ionian', chord: 'Dm7 G7 Cmaj7', bpm: 140, diff: 3, tech: ['eighth notes', 'chord tones'], targets: ['3'],
    theory: 'Descends F–E–D–C over Dm7, outlines G7 (B–G–F–D), and resolves to E, the 3rd of Cmaj7.',
    tex: ':8 6.2 5.2 3.2 5.3 4.3 5.4 3.4 5.5 | 2.4{v}.2 r.2',
  }),
  L('benson-1', 'George Benson', 'jazz', 'Enclosure into the root', {
    key: 'C', scale: 'ionian', chord: 'Dm7', bpm: 160, diff: 4, tech: ['enclosure', 'chromatic'], targets: ['1 of Dm7'], passing: ['b2'],
    theory: 'Surrounds D from above (E) and below (C#) before landing on it: an enclosure, the core bebop device.',
    tex: '10.2.8 13.2.8 12.1.8 9.1.8 10.1.4 13.2.8 10.2.8',
  }),
  L('benson-2', 'George Benson', 'jazz', 'Bebop scale descent', {
    key: 'G', scale: 'bebop-dominant', chord: 'G7', bpm: 170, diff: 4, tech: ['bebop scale', 'eighth notes'], targets: ['1', '3', '5', 'b7'],
    theory: 'The added major 7th (F#) keeps every chord tone of G7 on a downbeat as the line descends from G.',
    tex: ':8 15.1 14.1 13.1 12.1 15.2 13.2 12.2 14.3 | 12.3{v}.2 r.2',
  }),
  L('metheny-1', 'Pat Metheny', 'jazz', 'Lyrical 9-3-5-7', {
    key: 'C', scale: 'ionian', chord: 'Cmaj7', bpm: 84, diff: 3, tech: ['slide', 'vibrato', 'space'], targets: ['9', '3', '5', '7'],
    theory: 'Climbs the upper structure of Cmaj9 (D–E–G–B) and holds the 7th: singable, wide and open.',
    tex: '15.2.8 12.1.8 15.1{sl}.4 19.1{v}.2',
  }),
  L('metheny-2', 'Pat Metheny', 'jazz', 'D major pentatonic over C', {
    key: 'C', scale: 'lydian', chord: 'Cmaj7#11', bpm: 120, diff: 4, tech: ['legato', 'superimposition'], targets: ['#4', '9', '7'],
    theory: 'D major pentatonic over Cmaj7 gives 9, 3, #11, 13 and 7: an instant Lydian sound from a familiar shape.',
    tex: ':8 15.2{h} 17.2 14.1{h} 17.1 14.1 17.2 15.2 16.3{v}',
  }),
  L('martino-1', 'Pat Martino', 'jazz', 'Minor conversion', {
    key: 'G', scale: 'mixolydian', chord: 'G7', bpm: 150, diff: 4, tech: ['arpeggio', 'superimposition'], targets: ['5', 'b7', '9'],
    theory: 'Plays a Dm7 arpeggio over G7: D–F–A–C are G7’s 5, b7, 9 and 11. Think minor, sound dominant.',
    tex: ':8 12.4 10.3 14.3 13.2 13.1 15.2 13.2 14.3',
  }),
  L('martino-2', 'Pat Martino', 'jazz', 'Endless sixteenths', {
    key: 'G', scale: 'mixolydian', chord: 'G7', bpm: 160, diff: 5, tech: ['sixteenths', 'alternate picking', 'sequence'], targets: ['b7', '3'],
    theory: 'A long, even line falling three notes per string through G Mixolydian, then turning back up.',
    tex: ':16 13.1 12.1 10.1 13.2 12.2 10.2 12.3 10.3 9.3 12.4 10.4 9.4 10.4 12.4 9.3 10.3',
  }),
  L('holdsworth-1', 'Allan Holdsworth', 'fusion', 'Whole-tone legato', {
    key: 'C', scale: 'whole-tone', chord: 'C7#5', bpm: 120, diff: 5, tech: ['legato', 'whole tone', 'stretch'], targets: ['#5', '3'],
    theory: 'Every step is a whole tone, so there is no "home" note; legato makes it float. Fits C7#5 or C9#11.',
    tex: ':16 13.2{h} 15.2{h} 17.2 14.1{h} 16.1{h} 18.1 16.1{h} 14.1 17.2{h} 15.2{h} 13.2 15.3{h} 13.3{h} 11.3 14.4.8',
  }),
  L('holdsworth-2', 'Allan Holdsworth', 'fusion', 'Quartal stacks', {
    key: 'A', scale: 'dorian', chord: 'Am7', bpm: 110, diff: 5, tech: ['fourths', 'sixteenths'], targets: ['b7', '4'],
    theory: 'Notes stacked in fourths (A–D–G–C, B–E–A–D) avoid the "scale run" sound and keep the harmony open.',
    tex: ':16 7.4 7.3 8.2 8.1 9.4 9.3 10.2 10.1 10.1 10.2 9.3 9.4 8.1 8.2 7.3 7.4',
  }),
  L('henderson-1', 'Scott Henderson', 'fusion', 'Altered line into Am', {
    key: 'E', scale: 'altered', chord: 'E7alt', bpm: 110, diff: 5, tech: ['altered', 'sixteenths'], targets: ['3', 'b9', '#5'], passing: ['4'],
    theory: 'G#–G–F–E–D–C–A#–G# packs E7’s 3rd with every altered tension, then steps up to A, the root of Am.',
    tex: ':16 16.1 15.1 13.1 12.1 15.2 13.2 11.2 13.3 14.3{v}.2',
  }),
  L('henderson-2', 'Scott Henderson', 'fusion', 'Side-slip and back', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7#9', bpm: 120, diff: 5, tech: ['side-slipping', 'sixteenths'], targets: ['1'], passing: ['b2', '3', '7', 'b6'],
    theory: 'Plays an E minor pentatonic cell, the same shape a half step higher (deliberately "outside"), then back in.',
    tex: ':16 15.1 12.1 15.2 12.2 16.1 13.1 16.2 13.2 15.1 12.1 15.2 12.2 14.4{v}.4',
  }),
  L('carlton-1', 'Larry Carlton', 'fusion', '3 → 9 → 13 → 5', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 96, diff: 3, tech: ['hammer-on', 'vibrato'], targets: ['3', '9', '13', '5'], passing: ['b3'],
    theory: 'Hammers b3 → 3, then picks 9 (B), 13 (F#) and 5 (E): chord tones and colour notes instead of plain pentatonic.',
    tex: '13.2{h}.8 14.2{v}.4 12.2.8 14.1.8 12.1{v}.4 r.8',
  }),
  L('carlton-2', 'Larry Carlton', 'fusion', 'Major to minor switch', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 100, diff: 3, tech: ['position playing', 'vibrato'], targets: ['5', '6', 'b3'], passing: ['b3'],
    theory: 'Starts in A major (E–F#–A–B–D), then drops in a C (b3) for a quick bluesy turn before resolving to E.',
    tex: ':8 9.3 11.3 10.2 12.2 10.1.4 8.1.8 10.2.8 | 9.3{v}.2 r.2',
  }),
];
