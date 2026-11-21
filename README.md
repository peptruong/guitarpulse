# GuitarPulse

An app for learning to improvise on guitar. It has:

- backing tracks in 24 styles;
- every scale on the neck, in any tuning;
- 126 licks written in the style of famous players;
- a coach that listens to you play and tells you what to work on;
- a jam partner that trades fours with you;
- an ear trainer.

Claude can use the same music engine through a connector, so it can answer theory questions and set up a jam for you as a link.

```
apps/web             Next.js app (what you open in the browser)
packages/core        the music engine: theory, grooves, licks, audio analysis, coach, trading, ear trainer
packages/mcp-server  the Claude connector (10 tools), built on the same engine
```

## Use it online

The app builds to plain files, so GitHub Pages hosts it for free with no server to run. Every push to `main` runs `.github/workflows/deploy.yml`. The workflow runs the tests, builds the site and publishes it to `https://<your-user>.github.io/<repo>/`. If a test fails, nothing is published and the site keeps its last working version.

One-time setup: create the repo on GitHub and, in the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**. Then push this code to `main`. If you pushed before switching the source, run the workflow again from the **Actions** tab.

The site is served over https, which browsers require before they allow the microphone, so the coach works on your phone too.

## Run it on your computer

Requires Node.js 20.3 or newer.

```bash
npm install
npm run dev            # builds the engine, then serves the app on http://localhost:3000
```

`npm run build` writes the site as plain files to `apps/web/out`, and `npm start -w @guitarpulse/web` previews them.

Use headphones for the backing track, so the microphone hears only your guitar. An audio interface works best; a laptop microphone also works.

### Optional: Claude's written coaching

After a coach session, the "Claude's take" card in the report asks for your Anthropic API key. Paste it once. It is saved only in that browser and sent only to Anthropic, straight from the page. **Forget key** removes it.

"Ask Claude" then sends only the session's numbers, never audio, and returns a short lesson with drills and a ready-made next session. Without a key, everything else works.

### Optional: the Claude connector

`packages/mcp-server/README.md` explains how to add it to Claude Code or Claude Desktop.

Ask "set me up a trading-fours jam over city pop in D" and Claude replies with a link that opens the app ready to play. The links point to `GUITARPULSE_APP_URL` (default `http://localhost:3000`). Set it to your GitHub Pages address, such as `https://<your-user>.github.io/guitarpulse`, and the links open the online app.

## The four bugs, fixed

| Bug | Cause | Fix |
|---|---|---|
| Changing speed also changed pitch | The tempo was changed by resampling | Generated tracks are scheduled in beats on the transport, so tempo only moves events in time. Your own recordings play through Signalsmith Stretch, which sets speed and key separately. |
| Note logs had no timing | Notes were logged by name only | The note tracker timestamps every note on the audio clock: start, end, length, peak bend and loudness. `BeatClock` turns those times into beats of the backing track, after subtracting the device latency. |
| The microphone never turned off | Closing the AudioContext left the MediaStream tracks running | `MicSession` owns the stream and stops every track on stop, on errors, and when you stop while the permission prompt is still open. The browser tests confirm every track ends after a coach or trading session. |
| Flat notes like B♭ never matched | Notes were compared by sharp-only names | Notes are compared by pitch class (0–11) and spelled only for display, using the key's sharps or flats. |

19 regression tests cover these fixes, using synthetic guitar audio. The audio includes picked notes, hammer-ons, sixteenths at 120 BPM, a whole-step bend, vibrato, drop C and fret 24.

## Features

1. **Trade fours** (`/trade`). You play four bars, then GuitarPulse answers with four bars built from your first idea.
   - Each answer develops your idea in one of five ways: it moves it, flips it, shifts it an eighth, stretches it or chops it up.
   - Every answer fits the chords and lands on the 3rd of the last chord.
   - When you reply, it tells you how much of its rhythm and shape you reused and whether you ended on a chord tone.
   - There is also a mode that works without a microphone.
2. **Asia sound pack**. Six grooves, 10 scales, 12 licks and a new tuning:
   - **Grooves:** city pop, anime rock (royal-road progression), K-ballad, wuxia (Chinese pentatonic with drone and gong), Vietnamese Điệu Bắc, and cải lương with a song lang clapper.
   - **Scales:** the five Chinese modes, Ryukyu, Điệu Bắc, Nam Xuân, Nam Ai and Hơi Oán. The Vietnamese modes list their pressed and vibrato notes.
   - **Licks:** 12 new style studies, including quarter-tone pressed bends for Hơi Oán.
   - **Tuning:** the Dây Lai tuning used on cải lương guitar.
3. **Song to practice** (`/song`). Type chords like `| Fmaj7 | E7 | Am7 | Gm7 C7 |`. You get:
   - the key and the name of the progression, if it is a famous one;
   - a backing track in any feel;
   - the scale and the 3rd/7th to aim for on every chord;
   - a guide-tone line;
   - a share link.
4. **Neck heatmap replay** (coach report). It shows where on the neck you played and plays it back in time with the track. A box report shows how much time you spent in each pentatonic box, which reveals a "box 1 habit".
5. **Lick mutator** (`/licks`). Move a lick to a new key, shift it an eighth, flip its contour, make it end on the 3rd of any chord, or play it backwards.
   - Steps can be chained and undone.
   - Each step explains what changed and keeps the tab playable.
6. **"Claude, set up my jam"**. The `guitarpulse_create_jam_session` tool returns a link, and `/jam` opens it.
   - The link holds the whole session (validated, URL-safe), so it needs no account or database.
   - The Studio's Share button makes the same kind of link.
7. **Pocket ear trainer** (`/ear`). Timed drills on intervals and chord qualities with spaced repetition.
   - Sounds you miss come back sooner, and new sounds unlock as you improve.
   - Results go into the same progress record as everything else.

The app also has:

- **Studio:** generated tracks, plus slowing down or transposing your own recordings.
- **Coach:** a report on chord tones on beats 1 and 3, space, phrase length, motifs, range, timing and bend accuracy.
- **Scales and chords:** 47 scales in 10 tunings, with CAGED, triad, shell, drop-2 and drop-3 voicings.
- **Learning path:** a week-by-week plan from your level.
- **Today:** a dashboard with your streak, trends, recent sessions, and export/import of your progress.

## Architecture

- **One engine, two front ends.** `packages/core` is plain TypeScript with no DOM dependency, so the browser app, the Claude connector and the tests all run the same code. Notes are integers; names appear only in the display.
- **One audio clock.** The app creates a single `AudioContext` and gives it to Tone.js. That same context runs the microphone tap (an AudioWorklet), the time-stretcher and the synths.
  - Mic notes, the transport and the trading answers therefore share one clock.
  - The answer to each trading window is computed three-quarters of a beat before the window starts, then scheduled on the transport.
- **Listening.** An AudioWorklet posts 2048-sample frames every 512 samples, each with its audio-clock time. `NoteTracker` turns them into notes.
  - Pitch detection uses pitchy (the McLeod method), with a median filter and pick-attack detection.
  - Legato pitch jumps are confirmed over two frames, so hammer-ons count as new notes.
  - Bends and vibrato stay one note.
- **Backing tracks** are written as data: a drum grid, bass tokens, a keys pattern and Roman-numeral progressions. They are rendered to beat-timed events and played by synthesized instruments, so nothing has to download.
- **Your data stays on the device.** Progress is stored in IndexedDB. If storage is blocked, the app keeps progress in memory and says so. You can export your progress and merge it on another device.
- **No server.** The app builds to static files. Claude's coaching runs in the browser with your own API key, which stays in that browser. The request is validated before it is sent, Claude answers through a tool schema, and each failure (refused key, no credit, busy, timeout, offline) gets a clear message.
- **Design.** The theme is dark (zinc-950 background, slate surfaces) with glass cards and one cyan accent.
  - **Degrees use the Okabe-Ito colour-blind-safe colours plus a shape each:** root square, 3rd circle, 5th diamond, 7th triangle, extensions hexagon. Colour is never the only cue.
  - **Fretboard:** vertical on phones, with a left-handed mode. You can move around it with the arrow keys and play a note with Enter.
  - **Accessibility:** screen-reader announcements for turn changes and answers, and reduced motion respected.

## Checks

```bash
npm test                 # engine (110 tests) and web logic (45 tests)
npm run validate:licks   # every lick parsed by alphaTab, bars add up, every pitch in its scale
npm run smoke            # starts the Claude connector and calls all 10 tools over stdio
```

The app was also tested end to end in headless Chrome, with a synthesized guitar played into a fake microphone.

- Those runs passed 39 checks with no console errors.
- They covered: the coach hearing notes and the microphone being released afterwards, trading fours answering from your idea, the time-stretcher, song analysis, the mutator, the ear trainer, jam links, progress export, and phone layouts with no sideways scrolling.

## About the licks and the Asia pack

- **Licks.** Every lick is a newly written phrase *in the style of* a player or tradition. None is a transcription, and famous riffs are avoided. For real solos, use licensed sources such as Songsterr, Hal Leonard or Guitar Pro mySongBook.
- **Vietnamese and Chinese modes.** These are equal-tempered approximations of traditions that bend pitch freely. The app marks which notes are pressed (nhấn) or vibrated (rung), so you can learn those inflections by ear.
- **Dây Lai tuning.** The note names follow how the tuning is taught. The octaves are an estimate based on the light strings that are used.
