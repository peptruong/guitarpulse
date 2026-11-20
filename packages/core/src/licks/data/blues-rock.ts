import { makeLick as L, type Lick } from '../types.js';

/**
 * Original style studies, newly written for GuitarPulse. They borrow general techniques and
 * note choices associated with each player; none is a transcription of a recorded solo.
 */
export const BLUES_ROCK: Lick[] = [
  // ── Blues ───────────────────────────────────────────────────────────────
  L('bb-king-1', 'B.B. King', 'blues', 'Box bend to the third', {
    key: 'A', scale: 'mixolydian', chord: 'A7', bpm: 70, diff: 1, tech: ['bend', 'vibrato', 'space'], targets: ['3'],
    theory: 'Bends the 9th (B) up a whole step to C#, the major 3rd of A7, then leaves a beat of silence so the bend can ring.',
    tex: '10.2.8 10.1.8 12.1{v}.4 12.2{b (0 4) v}.4 r.4',
  }),
  L('bb-king-2', 'B.B. King', 'blues', 'Sweet sixth descent', {
    key: 'A', scale: 'major-pentatonic', chord: 'A7', bpm: 72, diff: 2, tech: ['vibrato', 'position shift'], targets: ['6', '3', '1'],
    theory: 'Major pentatonic from the 5th down through the 6th (F#) and 3rd (C#) to the root; the 6th makes it sweet rather than gritty.',
    tex: '12.1.8 14.1.8 14.2.8 12.2.8 14.3{v}.4 r.4',
  }),
  L('albert-king-1', 'Albert King', 'blues', 'Pre-bend and release', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7', bpm: 76, diff: 3, tech: ['prebend', 'release', 'vibrato'], targets: ['5', 'b3', '1'],
    theory: 'Starts already bent to the 5th (B), releases slowly to the 4th, then walks b3 → b7 → root. The slow release is the expressive part.',
    tex: '14.3{b (4 4 0)}.4 12.3.8 12.4.8 14.4{v}.2',
  }),
  L('albert-king-2', 'Albert King', 'blues', 'One-and-a-half-step overbend', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7', bpm: 74, diff: 4, tech: ['overbend', 'release', 'bend'], targets: ['b3', '4', '1'],
    theory: 'Bends the root up a minor 3rd to G, releases, then bends the b3 up to the 4th: big, vocal bends instead of many notes.',
    tex: '17.2{b (0 6)}.4 17.2{b (6 0)}.8 15.2.8 15.1{b (0 4)}.4 12.1.8 r.8',
  }),
  L('freddie-king-1', 'Freddie King', 'blues', 'Minor-to-major hammer', {
    key: 'E', scale: 'major-blues', chord: 'E7', bpm: 110, diff: 2, tech: ['hammer-on', 'vibrato'], targets: ['3', '6'],
    theory: 'Hammers from the b3 (G) to the major 3rd (G#) of E7: the classic blues "rub" between minor and major.',
    tex: '12.3{h}.8 13.3.8 12.2.8 12.1.8 14.2{v}.4 12.2.8 r.8',
  }),
  L('freddie-king-2', 'Freddie King', 'blues', 'Double-stop stab and bend', {
    key: 'E', scale: 'dorian', chord: 'E7', bpm: 110, diff: 2, tech: ['double-stop', 'bend', 'vibrato'], targets: ['b7', '6', '1'],
    theory: 'Punchy b7/b3 double stops, a bend from b3 to the 4th, then the 6th (C#) before landing on the root.',
    tex: '(15.2 15.1).8 (15.2 15.1).8 r.8 15.1{b (0 4)}.4 12.1.8 14.2.8 12.2.8 | 14.4{v}.2 r.2',
  }),
  L('buddy-guy-1', 'Buddy Guy', 'blues', 'Whisper, then burst', {
    key: 'G', scale: 'minor-pentatonic', chord: 'G7', bpm: 90, diff: 3, tech: ['vibrato', 'sixteenths', 'dynamics'], targets: ['1'],
    theory: 'A quiet, wide-vibrato root followed by a fast descending pentatonic burst; the contrast in volume and speed is the point.',
    tex: '15.1{v}.2 :16 18.1 15.1 18.2 15.2 17.3 15.3 17.4 15.4 | :8 15.5{h} 17.5 17.4{v}.4 r.2',
  }),
  L('buddy-guy-2', 'Buddy Guy', 'blues', 'Bend-and-stab stutter', {
    key: 'G', scale: 'minor-pentatonic', chord: 'G7', bpm: 96, diff: 2, tech: ['bend', 'repetition', 'sixteenths'], targets: ['1'],
    theory: 'Alternates a b7 → root bend with the root on the next string, four times: repetition builds tension before the release.',
    tex: ':16 6.2{b (0 4)} 3.1 6.2{b (0 4)} 3.1 6.2{b (0 4)} 3.1 6.2{b (0 4)} 3.1 3.2.4 5.3{v}.4',
  }),
  L('srv-1', 'Stevie Ray Vaughan', 'blues', 'Open-position triplet cascade', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7', bpm: 116, diff: 3, tech: ['triplets', 'pull-off', 'open strings'], targets: ['1'],
    theory: 'Pull-offs to open strings in triplets, falling through the E minor pentatonic to the low E: a Texas-shuffle staple.',
    tex: ':8 {tu 3} 3.1{h} 0.1 3.2{h} 0.2 2.3{h} 0.3 2.4{h} 0.4 2.5 :4 0.6',
  }),
  L('srv-2', 'Stevie Ray Vaughan', 'blues', 'Box 1 to box 2 shift', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7', bpm: 112, diff: 3, tech: ['bend', 'slide', 'vibrato'], targets: ['1', '5'],
    theory: 'Bends b7 → root in box 1, slides up to box 2 and bends the 4th to the 5th: connecting positions instead of staying in one box.',
    tex: '12.1.8 15.1.8 15.2{b (0 4) v}.4 12.1.8 15.2{sl}.8 17.2.8 r.8 | 17.2.8 15.2.8 14.3{b (0 4) v}.4 14.3.8 12.3.8 14.4{v}.4',
  }),
  L('clapton-1', 'Eric Clapton', 'blues', 'Half-step curl to the major third', {
    key: 'A', scale: 'minor-pentatonic', chord: 'A7', bpm: 84, diff: 2, tech: ['bend', 'vibrato'], targets: ['3', '1'], passing: ['3'],
    theory: 'Minor pentatonic phrase that bends the b3 (C) a half step to C#, the 3rd of A7, then settles on the root.',
    tex: '5.1.8 8.1.8 5.1.8 8.2.8 5.2.8 5.3{b (0 2)}.4 7.4.8 | 7.4{v}.2 r.2',
  }),
  L('clapton-2', 'Eric Clapton', 'blues', 'Five-string cascade', {
    key: 'A', scale: 'minor-pentatonic', chord: 'A7', bpm: 92, diff: 1, tech: ['alternate picking', 'hammer-on', 'vibrato'], targets: ['1'],
    theory: 'Box 1 descending in even eighths, then a hammer-on from the 4th to the 5th that resolves to the root.',
    tex: ':8 8.1 5.1 8.2 5.2 7.3 5.3 7.4 5.4 | 5.5{h}.8 7.5.8 7.4{v}.2 r.4',
  }),
  L('gary-moore-1', 'Gary Moore', 'blues', 'Long bend, fast fall', {
    key: 'A', scale: 'aeolian', chord: 'Am', bpm: 76, diff: 4, tech: ['bend', 'vibrato', 'sixteenths'], targets: ['1'],
    theory: 'Holds a b7 → root bend for two beats, then falls an octave in sixteenths through the pentatonic to the root.',
    tex: '20.2{b (0 4) v}.2 :16 20.1 17.1 20.2 17.2 19.3 17.3 19.4 17.4 | 19.4{v}.2 r.2',
  }),
  L('gary-moore-2', 'Gary Moore', 'blues', 'Harmonic-minor flash', {
    key: 'A', scale: 'harmonic-minor', chord: 'E7', bpm: 120, diff: 4, tech: ['sixteenths', 'alternate picking'], targets: ['7', '1'],
    theory: 'Over E7 heading to Am, the G# (raised 7th of A harmonic minor) is E7’s 3rd and pulls straight up to A.',
    tex: ':16 17.1 16.1 13.1 12.1 15.2 13.2 12.2 13.3 14.3{v}.2',
  }),
  L('bonamassa-1', 'Joe Bonamassa', 'blues', 'Descending fours', {
    key: 'B', scale: 'minor-pentatonic', chord: 'Bm7', bpm: 100, diff: 4, tech: ['sequence', 'sixteenths', 'bend'], targets: ['1', '5'],
    theory: 'A four-note sequence moving down the box one step at a time, then a b3 → 4 bend and the root: sequences turn a scale into music.',
    tex: ':16 10.1 7.1 10.2 7.2 7.1 10.2 7.2 9.3 10.2 7.2 9.3 7.3 7.2 9.3 7.3 9.4 | :8 9.4 7.4 7.3{b (0 4)}.4 9.4{v}.2',
  }),
  L('bonamassa-2', 'Joe Bonamassa', 'blues', 'Major pentatonic climb', {
    key: 'B', scale: 'major-pentatonic', chord: 'B', bpm: 104, diff: 3, tech: ['sixteenths', 'bend', 'vibrato'], targets: ['3', '1'],
    theory: 'Climbs B major pentatonic, bends the 2nd (C#) to the 3rd (D#) and falls back to the root and 6th.',
    tex: ':16 6.4 9.4 6.3 8.3 7.2 9.2 7.1 9.1 9.1{b (0 4) v}.4 7.1.8 9.2.8',
  }),
  L('peter-green-1', 'Peter Green', 'blues', 'Space and the ninth', {
    key: 'B', scale: 'aeolian', chord: 'Bm', bpm: 66, diff: 2, tech: ['space', 'vibrato', 'slide'], targets: ['1', '9'],
    theory: 'Two beats of root, two beats of silence, then a slide from B up to C# (the 9th) for a moody, unresolved colour.',
    tex: '7.1{v}.2 r.2 | 10.1.8 7.1.8 12.2{sl}.4 14.2{v}.4 r.4',
  }),
  L('peter-green-2', 'Peter Green', 'blues', 'Minor reverb drift', {
    key: 'B', scale: 'aeolian', chord: 'Bm', bpm: 70, diff: 2, tech: ['bend', 'vibrato', 'space'], targets: ['1'],
    theory: 'A short falling phrase with one b7 → root bend, a rest, then a long root: let reverb fill the gaps.',
    tex: ':8 9.3 7.3 10.2{b (0 4)} 7.2 9.3.4 r.4 | 9.4{v}.2 r.2',
  }),

  // ── Rock ────────────────────────────────────────────────────────────────
  L('hendrix-1', 'Jimi Hendrix', 'rock', 'Sliding double stops', {
    key: 'E', scale: 'mixolydian', chord: 'E', bpm: 96, diff: 3, tech: ['double-stop', 'slide', 'vibrato'], targets: ['1', '3'],
    theory: 'Thirds on the G and B strings slide into E/G# (root and 3rd), with a sus4 flicker (A) in between, like chord embellishments.',
    tex: '(7.3{sl} 7.2{sl}).8 (9.3 9.2).8 (9.3 10.2).8 (9.3 9.2).8 (11.3 12.2).4 (9.3{v} 9.2{v}).4',
  }),
  L('hendrix-2', 'Jimi Hendrix', 'rock', 'Unison scream', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E7#9', bpm: 100, diff: 3, tech: ['unison-bend', 'vibrato'], targets: ['1'],
    theory: 'Bends D up to E while holding E on the top string, so two strings fight into one pitch, then descends the box.',
    tex: '(15.2{b (0 4)} 12.1).2 12.2.8 14.3.8 12.3.8 14.4{v}.8',
  }),
  L('page-1', 'Jimmy Page', 'rock', 'Triplet pull-off loop', {
    key: 'A', scale: 'minor-pentatonic', chord: 'Am', bpm: 120, diff: 3, tech: ['triplets', 'pull-off', 'repetition'], targets: ['b3', '1'],
    theory: 'A four-note cell played in triplets, so the accent lands on a different note each beat: a rhythmic illusion, not just speed.',
    tex: ':8 {tu 3} 8.1{h} 5.1 8.2{h} 5.2 8.1{h} 5.1 8.2{h} 5.2 8.1{h} 5.1 8.2{h} 5.2',
  }),
  L('page-2', 'Jimmy Page', 'rock', 'Open-string drone', {
    key: 'E', scale: 'mixolydian', chord: 'E', bpm: 100, diff: 2, tech: ['open strings', 'sixteenths', 'bend'], targets: ['1', '5'],
    theory: 'A descending melody on the B string alternates with the open E string as a drone, then bends the 4th to the 5th.',
    tex: ':16 7.2 0.1 5.2 0.1 3.2 0.1 5.2 0.1 2.3.8 0.2.8 2.3{b (0 4)}.4',
  }),
  L('gilmour-1', 'David Gilmour', 'rock', 'Unison bend, then the ninth', {
    key: 'D', scale: 'dorian', chord: 'Dm', bpm: 64, diff: 2, tech: ['unison-bend', 'vibrato', 'space'], targets: ['1', '9', '6'],
    theory: 'A unison bend on the root, then the 9th (E) and the dorian 6th (B): slow, lyrical, every note held.',
    tex: '(13.2{b (0 4)} 10.1).2 12.1.8 10.1.8 12.2{v}.4',
  }),
  L('gilmour-2', 'David Gilmour', 'rock', 'Slow major bends with space', {
    key: 'G', scale: 'major-pentatonic', chord: 'G', bpm: 68, diff: 2, tech: ['bend', 'vibrato', 'space'], targets: ['3', '6', '1'],
    theory: 'Bends to the 3rd and then the 6th of G, rests a beat, and resolves down 6 → 3 → root.',
    tex: '14.3{b (0 4)}.4 12.2.8 15.2.8 15.2{b (0 4) v}.2 | r.4 12.1.8 12.2.8 12.3{v}.2',
  }),
  L('may-1', 'Brian May', 'rock', 'Harmonised thirds climb', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 100, diff: 3, tech: ['double-stop', 'harmony', 'vibrato'], targets: ['1', '3'],
    theory: 'A melody harmonised in diatonic thirds on the G and B strings, as if two guitars were playing it.',
    tex: '(12.3 12.2).8 (14.3 13.2).8 (16.3 15.2).8 (17.3 17.2).8 (19.3 19.2).4 (17.3{v} 17.2{v}).4',
  }),
  L('may-2', 'Brian May', 'rock', 'Singing scale line', {
    key: 'G', scale: 'ionian', chord: 'G', bpm: 96, diff: 2, tech: ['vibrato', 'melody'], targets: ['1'],
    theory: 'A stepwise climb from the 5th to the 9th that falls back to the root, phrased like a vocal melody.',
    tex: ':8 15.2 12.1 14.1 15.1 17.1.4 15.1{v}.4',
  }),
  L('knopfler-1', 'Mark Knopfler', 'rock', 'Hybrid-picked double stops', {
    key: 'D', scale: 'mixolydian', chord: 'D', bpm: 104, diff: 3, tech: ['hybrid-picking', 'double-stop', 'hammer-on'], targets: ['1', '3', 'b7'],
    theory: 'Root/3rd double stops snapped with the fingers, then the b7 (C) with the 9th (E): pure Mixolydian colour.',
    tex: '(7.3 7.2).8 (7.3 7.2).8 10.2.8 7.2.8 5.3{h}.8 7.3.8 (5.3 5.2).4',
  }),
  L('knopfler-2', 'Mark Knopfler', 'rock', 'Snap fills', {
    key: 'D', scale: 'mixolydian', chord: 'D', bpm: 108, diff: 3, tech: ['hybrid-picking', 'pull-off', 'space'], targets: ['1', '5'],
    theory: 'A quick pull-off from the root to the b7, short fills, a rest, then a 5th/root dyad: phrase like a singer taking a breath.',
    tex: '10.1{h}.16 8.1.16 7.2.16 10.2.8 7.2.16 9.3.8 r.4 (7.4 7.3).4',
  }),
  L('slash-1', 'Slash', 'rock', 'Harmonic-minor turn', {
    key: 'E', scale: 'harmonic-minor', chord: 'Em', bpm: 110, diff: 3, tech: ['bend', 'hammer-on', 'vibrato'], targets: ['7', '1'],
    theory: 'A pentatonic bend, then the b6 (C) and the raised 7th (D#) that hammers up to the root.',
    tex: '15.1{b (0 4)}.4 12.1.8 13.2.8 12.2.8 12.3.8 13.4{h}.8 14.4{v}.8',
  }),
  L('slash-2', 'Slash', 'rock', 'Wide-vibrato climb', {
    key: 'E', scale: 'minor-pentatonic', chord: 'Em', bpm: 116, diff: 2, tech: ['bend', 'vibrato'], targets: ['1'],
    theory: 'Climbs box 1 with one 4th → 5th bend and finishes on the high root with slow, wide vibrato.',
    tex: ':8 12.4 14.4 12.3 14.3{b (0 4)} 12.2 17.2{v}.4 r.8',
  }),
  L('angus-1', 'Angus Young', 'rock', 'Pull-off machine gun', {
    key: 'A', scale: 'minor-pentatonic', chord: 'A5', bpm: 132, diff: 2, tech: ['pull-off', 'sixteenths', 'bend'], targets: ['1', '5'],
    theory: 'A wide root → 5th pull-off repeated in sixteenths, ending with a 4th → 5th bend.',
    tex: ':16 17.1{h} 12.1 17.1{h} 12.1 17.1{h} 12.1 17.1{h} 12.1 15.2{b (0 4) v}.2',
  }),
  L('angus-2', 'Angus Young', 'rock', 'Box 1 bend stabs', {
    key: 'A', scale: 'minor-pentatonic', chord: 'A5', bpm: 128, diff: 2, tech: ['bend', 'vibrato'], targets: ['1'],
    theory: 'b7 → root bends answered by the root on the top string, then a quick descent to the b3.',
    tex: ':8 8.2{b (0 4)} 5.1 8.2{b (0 4)} 5.1 5.2 7.3 5.3{v}.4',
  }),
  L('evh-1', 'Eddie Van Halen', 'rock', 'Tapped triplets', {
    key: 'E', scale: 'aeolian', chord: 'Em', bpm: 132, diff: 4, tech: ['tapping', 'triplets', 'legato'], targets: ['1', 'b6'],
    theory: 'Tap, pull-off, hammer-on in triplets: E–A–C on the top string, then B–E–G on the B string.',
    tex: '12.1{h}.8 {tu 3 tt} 5.1{h}.8 {tu 3} 8.1.8 {tu 3} 12.1{h}.8 {tu 3 tt} 5.1{h}.8 {tu 3} 8.1.8 {tu 3} 12.2{h}.8 {tu 3 tt} 5.2{h}.8 {tu 3} 8.2.8 {tu 3} 12.2{h}.8 {tu 3 tt} 5.2{h}.8 {tu 3} 8.2.8 {tu 3}',
  }),
  L('evh-2', 'Eddie Van Halen', 'rock', 'Open-string cascade', {
    key: 'E', scale: 'dorian', chord: 'Em', bpm: 140, diff: 3, tech: ['pull-off', 'open strings', 'sixteenths'], targets: ['1'],
    theory: 'Pull-offs to every open string from top to bottom; the C# on the B string gives a dorian brightness.',
    tex: ':16 3.1{h} 0.1 2.1{h} 0.1 3.2{h} 0.2 2.2{h} 0.2 2.3{h} 0.3 2.4{h} 0.4 2.5{h} 0.5 0.6.8',
  }),
  L('rhoads-1', 'Randy Rhoads', 'metal', 'Trill into the leading tone', {
    key: 'A', scale: 'harmonic-minor', chord: 'E7', bpm: 108, diff: 4, tech: ['trill', 'sixteenths', 'vibrato'], targets: ['7', '1'],
    theory: 'A trill on E–F (5th and b6), then a run down to G#, the leading tone, which resolves up to A.',
    tex: '12.1{tr 13 16}.2 15.2.16 13.2.16 12.2.16 13.3.16 14.3{v}.4',
  }),
  L('rhoads-2', 'Randy Rhoads', 'metal', 'Diminished climb to the root', {
    key: 'A', scale: 'harmonic-minor', chord: 'E7', bpm: 112, diff: 4, tech: ['arpeggio', 'sixteenths'], targets: ['1'],
    theory: 'G# diminished 7th (G#–B–D–F) stacked up two octaves; every note is a half step from a note of Am, so it resolves strongly.',
    tex: ':16 11.5 9.4 12.4 10.3 13.3 12.2 15.2 13.1 17.1{v}.2',
  }),
  L('wylde-1', 'Zakk Wylde', 'metal', 'Six-note pentatonic loop', {
    key: 'E', scale: 'minor-pentatonic', chord: 'Em', bpm: 120, diff: 4, tech: ['sextuplets', 'alternate picking'], targets: ['1'],
    theory: 'A six-note descending cell in sixteenth-note triplets, repeated three times before landing on the root.',
    tex: ':16 {tu 3} 15.1 12.1 15.2 12.2 14.3 12.3 15.1 12.1 15.2 12.2 14.3 12.3 15.1 12.1 15.2 12.2 14.3 12.3 :4 14.4{v}',
  }),
  L('wylde-2', 'Zakk Wylde', 'metal', 'Pinch-harmonic bend', {
    key: 'E', scale: 'minor-pentatonic', chord: 'Em', bpm: 100, diff: 3, tech: ['pinch-harmonic', 'bend', 'vibrato'], targets: ['5'],
    theory: 'A pinch harmonic on a 4th → 5th bend with wide vibrato, then a quick fall to the 5th an octave down.',
    tex: '14.3{ph b (0 4) v}.2 12.3.8 14.4.8 12.4.8 14.5{v}.8',
  }),
  L('hammett-1', 'Kirk Hammett', 'metal', 'Chromatic wah climb', {
    key: 'E', scale: 'minor-pentatonic', chord: 'Em', bpm: 126, diff: 3, tech: ['chromatic', 'bend', 'wah'], targets: ['1'], passing: ['b2', '2'],
    theory: 'Climbs chromatically from E to G, bends the 4th to the 5th and finishes on the high root.',
    tex: ':16 9.3 10.3 11.3 12.3 14.3{b (0 4)}.4 12.2.8 15.2.8 12.1{v}.4',
  }),
  L('hammett-2', 'Kirk Hammett', 'metal', 'Phrygian run', {
    key: 'E', scale: 'phrygian', chord: 'E5', bpm: 140, diff: 4, tech: ['sixteenths', 'alternate picking'], targets: ['b2', '1'],
    theory: 'The F (b2) right next to the root is what makes Phrygian sound dark and heavy.',
    tex: ':16 12.1 13.1 15.1 13.1 12.1 15.2 13.2 12.2 14.3 12.3 14.3 12.3 14.4.4',
  }),
  L('jack-white-1', 'Jack White', 'rock', 'Fuzz slide climb', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E5', bpm: 112, diff: 2, tech: ['slide', 'vibrato', 'bend'], targets: ['4', '1'],
    theory: 'Slides on one string root → b3 → 4, like a slide guitar, then bends b7 → root.',
    tex: '12.1{sl}.8 15.1{sl}.8 17.1{v}.4 15.1.8 12.1.8 15.2{b (0 4)}.4',
  }),
  L('jack-white-2', 'Jack White', 'rock', 'Octave riff-lick', {
    key: 'E', scale: 'minor-pentatonic', chord: 'E5', bpm: 118, diff: 2, tech: ['octaves'], targets: ['1', '5'],
    theory: 'Pentatonic notes doubled in octaves (strings 5 and 3, muting the 4th): huge sound from a simple line.',
    tex: '(7.5 9.3).8 (7.5 9.3).8 (10.5 12.3).8 (12.5 14.3).8 (14.5 16.3).4 (12.5 14.3).4',
  }),
];
