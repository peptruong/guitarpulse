import { makeLick as L, type Lick } from '../types.js';

/**
 * Asia sound pack: original genre studies (not transcriptions) in standard tuning.
 * Vietnamese pressed notes (nhấn) are written as quarter-tone bends, the closest thing tab can show.
 */
export const ASIA: Lick[] = [
  L('city-pop-1', 'City pop guitar', 'city-pop', 'Royal road 3rds', {
    key: 'D', scale: 'ionian', chord: 'Gmaj7 A7', bpm: 112, diff: 2, tech: ['chord tones', 'vibrato'], targets: ['3'],
    theory: 'Starts on B, the 3rd of Gmaj7, and lands on C#, the 3rd of A7, on the downbeat: the royal road is all about the 3rds.',
    tex: '12.2.8 10.1.8 14.1.8 12.1.8 15.2.4 12.2.8 14.2.8 | 14.2{v}.2 r.2',
  }),
  L('city-pop-2', 'City pop guitar', 'city-pop', 'Muted sixteenth groove', {
    key: 'D', scale: 'ionian', chord: 'Bm7', bpm: 112, diff: 3, tech: ['dead-notes', 'sixteenths', 'funk'], targets: ['11', 'b3'],
    theory: 'Funk sixteenths with muted strums between notes; over Bm7 the E and D are its 11th and b3, a smooth city-pop colour.',
    tex: ':16 x.3 9.3 x.3 9.3 12.2 x.2 10.1 x.1 10.2 x.2 7.1.8 10.2.8 7.2{v}.8',
  }),
  L('anime-1', 'Anime rock guitar', 'anime', 'Hero’s climb', {
    key: 'A', scale: 'ionian', chord: 'Dmaj7 E7', bpm: 172, diff: 3, tech: ['sixteenths', 'bend', 'vibrato'], targets: ['7', '6'],
    theory: 'A fast climb through A major that ends with a bend from F# up to G#, the 3rd of E7: bright, rising, heroic.',
    tex: ':16 9.4 11.4 9.3 11.3 9.2 10.2 9.1 12.1 14.1{b (0 4) v}.2',
  }),
  L('anime-2', 'Anime rock guitar', 'anime', 'Bend-and-release cry', {
    key: 'A', scale: 'ionian', chord: 'F#m', bpm: 160, diff: 3, tech: ['bend', 'release', 'vibrato'], targets: ['1 of F#m'],
    theory: 'A singing bend to E, answered by F#, then a pre-bent release back to D that walks down to A: an emotional vi-chord phrase.',
    tex: '15.2{b (0 4) v}.4 14.1.8 15.2{b (4 0)}.8 14.2.8 12.2.8 14.3{v}.4',
  }),
  L('k-ballad-1', 'K-R&B ballad guitar', 'k-pop', 'Gospel b3 to 3', {
    key: 'Eb', scale: 'major-blues', chord: 'Ebmaj7', bpm: 70, diff: 3, tech: ['hammer-on', 'gospel run'], targets: ['3', '1'],
    theory: 'Hammers Gb up to G (b3 to 3) and runs down F–Eb–C–Bb–G to the root: the gospel colour behind K-R&B vocals.',
    tex: '14.1{h}.16 15.1.16 13.1.8 11.1.8 13.2.8 11.2.8 12.3.8 13.4{v}.4',
  }),
  L('k-ballad-2', 'K-R&B ballad guitar', 'k-pop', 'Falling line over V/VII', {
    key: 'Eb', scale: 'ionian', chord: 'Ebmaj7 Bb/D', bpm: 70, diff: 2, tech: ['slide', 'vibrato', 'melody'], targets: ['3', '1'],
    theory: 'Steps down G–F–Eb–D together with the falling bass, then resolves to Eb: melody and bass moving as one, like a ballad vocal.',
    tex: '15.1{sl}.4 13.1.8 11.1.8 10.1.4 11.1{v}.4',
  }),
  L('wuxia-1', 'Wuxia guzheng-style guitar', 'wuxia', 'Zither rake into a pressed note', {
    key: 'A', scale: 'yu', chord: 'A5 drone', bpm: 66, diff: 3, tech: ['rake', 'bend', 'vibrato'], targets: ['1'],
    theory: 'A fast upward rake through the Yu mode imitates a guzheng glissando; bending G up to A imitates its pressed-string technique.',
    tex: ':32 5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 8.2{b (0 4) v}.2 5.1.4',
  }),
  L('wuxia-2', 'Wuxia guzheng-style guitar', 'wuxia', 'Hero’s theme in Gong mode', {
    key: 'D', scale: 'gong', chord: 'D5 drone', bpm: 72, diff: 2, tech: ['slide', 'vibrato', 'melody'], targets: ['1', '5'],
    theory: 'A slow melody using only the five Gong notes (D E F# A B), with a slide up to F# and a long return to A: open and heroic.',
    tex: '10.2.4 12.2.8 10.1.8 12.1{sl}.4 14.1{v}.4 | 12.1.8 10.1.8 12.2.4 10.2{v}.2',
  }),
  L('dieu-bac-1', 'Vietnamese Điệu Bắc', 'vietnamese', 'Điệu Bắc folk line', {
    key: 'G', scale: 'dieu-bac', chord: 'Gsus2', bpm: 92, diff: 2, tech: ['vibrato', 'melody'], targets: ['1', '2', '6'],
    theory: 'Hò (G) up through Xự, Xang and Xê to Cống (E) and back; Xự (A) and Cống (E) get vibrato (rung), which gives the mode its colour.',
    tex: '12.3.8 14.3{v}.8 13.2.8 15.2.8 12.1{v}.4 15.2.8 13.2.8 | 14.3{v}.4 12.3.2 r.4',
  }),
  L('dieu-bac-2', 'Vietnamese Điệu Bắc', 'vietnamese', 'Hò–Xang, Xê–Liu fourths', {
    key: 'G', scale: 'dieu-bac', chord: 'Gsus2', bpm: 88, diff: 2, tech: ['fourths', 'vibrato'], targets: ['1', '4', '5'],
    theory: 'Built on the mode’s frame of two fourths, Hò–Xang and Xê–Liu (G–C and D–G here), then a vibrato Xự before settling on Hò.',
    tex: '12.3.8 13.2.8 15.2.8 15.1.8 15.2{v}.4 13.2.8 12.3.8 | 14.3{v}.4 10.4.4 12.3{v}.2',
  }),
  L('hoi-oan-1', 'Cải lương guitar (Hơi Oán)', 'vietnamese', 'Pressed Xự and Cống', {
    key: 'G', scale: 'hoi-oan', chord: 'G drone', bpm: 60, diff: 3, tech: ['nhấn (press)', 'rung (vibrato)'], targets: ['1'],
    theory: 'Cống (Eb) and Xự (Bb) are pressed a quarter tone sharp, between the Western notes, then the phrase settles on Hò (G) with slow vibrato, as in Hơi Oán.',
    tex: '13.1.8 11.1{b (0 1)}.4 15.2.8 13.2.8 11.2{b (0 1) v}.4 r.8 | 12.3{v}.2 r.2',
  }),
  L('hoi-oan-2', 'Cải lương guitar (Hơi Oán)', 'vietnamese', 'Settling on Hò', {
    key: 'G', scale: 'hoi-oan', chord: 'G drone', bpm: 56, diff: 4, tech: ['nhấn (press)', 'rung (vibrato)', 'release'], targets: ['1'],
    theory: 'Oan (F) gets vibrato, Cống is pressed and released, and the line falls through Xê, Xang and a pressed Xự to Hò, held long like the end of a vọng cổ line.',
    tex: '15.2.4 13.1{v}.4 11.1{b (0 1 0)}.8 15.2.8 13.2.8 11.2{b (0 1)}.8 | 12.3{v}.1',
  }),
];
