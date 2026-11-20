# GuitarPulse MCP server

The GuitarPulse theory engine, licks vault, improvisation coach, practice planner and jam-session links, exposed to Claude as an MCP server. Ask Claude things like *"what should I play over Dm7 G7 Cmaj7?"*, *"give me that B.B. King lick in C, landing on the 3rd of F7"* or *"set me up a trading-fours jam over city pop"* and it answers from this engine instead of from memory, and can hand you a link that opens GuitarPulse ready to play.

The tools run locally with no API keys. They use `@guitarpulse/core`, the same engine the GuitarPulse web app runs, so the app and Claude always agree.

## Tools

| Tool | What it does |
|---|---|
| `guitarpulse_list_catalog` | Valid scale ids, tunings, voicing systems, backing-track grooves (with progressions), lick genres, artists and practice goals |
| `guitarpulse_get_scale` | Any of 47 scales from any root, correctly spelled, mapped to the neck; pentatonic boxes 1–5 and 3NPS patterns 1–7 |
| `guitarpulse_get_chord_voicings` | CAGED, triads on every string set, shells, drop-2 and drop-3, with fingers, inversions and barres |
| `guitarpulse_suggest_scales_for_progression` | Ranked scales per chord with reasons, guide tones, avoid notes and a guide-tone line; detects V→I and 12-bar blues |
| `guitarpulse_search_licks` | 126 original style studies (63 players and styles, including the Asia pack) as alphaTex tab, with filters and pagination |
| `guitarpulse_mutate_lick` | New key, shift by an eighth, flip the contour, end on the next chord's 3rd, or play it backwards; steps chain and the tab is re-barred and re-fingered |
| `guitarpulse_song_to_practice` | A chord chart in, the key, named progression, scale and 3rd/7th per chord, a guide-tone line, a focus tip and an app link with a backing track out |
| `guitarpulse_analyze_improv_session` | Metrics from the pitch tracker's notes (chord tones on strong beats, space, motifs, timing, bends…) plus the one thing to fix next |
| `guitarpulse_generate_practice_plan` | Week-by-week plan by level (1–9), goals, minutes per day and weeks, with tracks, coach targets, new and review licks |
| `guitarpulse_create_jam_session` | Builds a session (backing track, coached jam, trading fours, song or ear drill) and returns a link that opens the app ready to play |

All tools are read-only: nothing is stored on the server, and a jam session lives entirely in its link. Every tool except `guitarpulse_create_jam_session` accepts `response_format: "markdown"` (default) or `"json"` (full data in `structuredContent`); the jam tool always returns both.

## Jam links

`guitarpulse_create_jam_session` and `guitarpulse_song_to_practice` return links like `https://your-app/jam/?s=<code>`. The code is the session itself (validated JSON, base64url), so links work without accounts or a database and can be shared. Set the app address with an environment variable:

```bash
GUITARPULSE_APP_URL=https://guitarpulse.example.com node dist/index.js
```

It defaults to `http://localhost:3000`, which is where `npm run dev` serves the web app. To have links open the online app instead, set it to your GitHub Pages address, such as `https://<your-user>.github.io/guitarpulse`.

## Install and run

Requires Node.js 20.3 or newer. From the repository root:

```bash
npm install
npm run build -w @guitarpulse/core
npm run build -w guitarpulse-mcp-server
```

### Claude Code

```bash
claude mcp add guitarpulse -e GUITARPULSE_APP_URL=http://localhost:3000 -- node /absolute/path/to/guitarpulse/packages/mcp-server/dist/index.js
```

### Claude Desktop

Add to `claude_desktop_config.json`, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "guitarpulse": {
      "command": "node",
      "args": ["/absolute/path/to/guitarpulse/packages/mcp-server/dist/index.js"],
      "env": { "GUITARPULSE_APP_URL": "http://localhost:3000" }
    }
  }
}
```

### Remote (Streamable HTTP)

```bash
TRANSPORT=http PORT=3100 npm start   # serves http://127.0.0.1:3100/mcp
```

It binds to localhost with Host/Origin checks. To expose it publicly (for example as a claude.ai custom connector), put it behind HTTPS and add bearer authentication first.

### Try it by hand

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Checks

```bash
npm run smoke   # starts the built server and calls all 10 tools over stdio, including bad input
```

The engine's own tests (`npm test` in `packages/core`) cover theory, licks, the coach, the four audio bug fixes, the lick mutator, song charts, grooves, trading fours, the ear trainer, jam links and the progress record. `npm run validate:licks` parses every lick with alphaTab, checks each bar adds up, and checks every sounding pitch against the lick's scale.

## About the licks

Every lick is a short, newly written phrase **in the style of** a player or tradition: it borrows general techniques and note choices (B.B. King's box bends, Wes Montgomery's octaves, the pressed notes of cải lương guitar) but is not a transcription of any recorded solo, and avoids famous recognisable riffs. Each one is marked `original: true` and its alphaTex subtitle says "Original style study". For accurate transcriptions of real solos, use licensed sources such as Songsterr, Ultimate Guitar official tabs, Hal Leonard or Guitar Pro mySongBook, and link to them rather than re-hosting their tabs. Before any public launch, have the use of artist names reviewed.

Strings are numbered the guitarist's way everywhere (1 = high E); chord charts read lowest string first (`x32010` = open C).

## Layout

```
src/
  index.ts     entry point: stdio, or Streamable HTTP when TRANSPORT=http
  server.ts    createServer(): registers the ten tools
  format.ts    Markdown renderers
scripts/
  smoke.ts     stdio self-check
```
