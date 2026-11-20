# GuitarPulse on GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/web` to plain files that GitHub Pages serves at `https://<user>.github.io/<repo>/`, redeployed by GitHub Actions on every push to `main`.

**Architecture:** Next.js static export (`output: 'export'`) with a base path injected at build time. The one server route (`/api/coach`) is replaced by a browser call to the Anthropic API using a key the user pastes in. A GitHub Actions workflow tests, builds, and publishes.

**Tech Stack:** Next.js 16.4.3, React 19.3, TypeScript 5.9, Node test runner + tsx, `@anthropic-ai/sdk` 1.6.0, GitHub Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

**Spec:** `docs/superpowers/specs/2026-11-20-github-pages-design.md`

## Global Constraints

- Node `>=20.3` (root `engines`); CI uses Node 24.
- Base path comes only from `NEXT_PUBLIC_BASE_PATH`: empty locally, `/<repo>` on Pages. Never hard-code `/guitarpulse` in app code.
- No server code may remain in `apps/web`: no route handlers, no `headers()` in `next.config.ts`.
- Coach model stays `claude-haiku-5-5` (`DEFAULT_COACH_MODEL`). `@anthropic-ai/sdk` is pinned to exactly `1.6.0` (the newest release at least two weeks old).
- No API key in the repo or in `apps/web/out`. The key lives only in the browser's `localStorage` under `guitarpulse.anthropicKey`.
- Every commit leaves `npm test` passing.

## Review Focus

1. **Opening a sub-page directly or refreshing it** (`/guitarpulse/coach`) on Pages loads that page, not a 404. Checked in Task 3 on the Pages-like local server.
2. **A jam link with `?s=…` from the Share button or the Claude connector** opens the session under the prefix. Tested by `absoluteUrl` tests (Task 1) and checked by hand in Task 3.
3. **Browser storage is blocked** (private mode, blocked site data): saving the key never throws. The key works for this visit, and the card says it wasn't saved. Test in Task 2.
4. **A pasted key with spaces or a newline, or text that isn't a key**, is trimmed or rejected before any request. Test in Task 2.
5. **Each way Claude can fail** (bad key 401/403, no credit 402, busy 429/529/5xx, refusal, timeout, offline, garbled reply) shows its own plain message and never crashes the report. Tests in Task 2.

---

### Task 0: Baseline repo

- [ ] **Step 1:** `git init -b main` in the repo root. Add `apps/web/out/` to `.gitignore`.
- [ ] **Step 2:** Scan for secrets: `grep -rIl "sk-ant-" --exclude-dir=node_modules .` → no output.
- [ ] **Step 3:** `npm run build -w @guitarpulse/core && npm test` → all core and web tests pass.
- [ ] **Step 4:** Commit everything as `chore: import GuitarPulse` (the specs and plans docs included).

### Task 1: Static build under any base path

**Files:**
- Create: `apps/web/lib/basePath.ts`, `apps/web/public/.nojekyll` (empty), `apps/web/test/basePath.test.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/app/layout.tsx` (metadata), `apps/web/lib/audio/stretch.ts:8-13`, `apps/web/features/Song.tsx:117-119`, `apps/web/features/Studio.tsx:191-195`, `apps/web/package.json` (`start` script)

**Interfaces:**
- Produces, in `lib/basePath.ts`:
  - `normalizeBase(raw: string | undefined): string` → `''` or `'/seg[/seg]'` (leading slash added, trailing slashes removed)
  - `BASE_PATH: string` = `normalizeBase(process.env.NEXT_PUBLIC_BASE_PATH)`
  - `withBase(path: string, base = BASE_PATH): string`, where `path` starts with `/`
  - `absoluteUrl(origin: string, path: string, base = BASE_PATH): string` = `origin` + `withBase(path, base)`

- [ ] **Step 1: Write failing tests** in `test/basePath.test.ts`:
  - `normalizeBase(undefined) === ''`, `normalizeBase('') === ''`, `normalizeBase('/') === ''`, `normalizeBase('guitarpulse') === '/guitarpulse'`, `normalizeBase('/guitarpulse/') === '/guitarpulse'`
  - `withBase('/jam?s=abc', '') === '/jam?s=abc'`; `withBase('/jam?s=abc', '/guitarpulse') === '/guitarpulse/jam?s=abc'`
  - `absoluteUrl('https://example.github.io', '/jam?s=x', '/guitarpulse') === 'https://example.github.io/guitarpulse/jam?s=x'`
- [ ] **Step 2:** `npm test -w @guitarpulse/web` → FAIL (module not found).
- [ ] **Step 3:** Implement `lib/basePath.ts`.
- [ ] **Step 4:** `npm test -w @guitarpulse/web` → PASS.
- [ ] **Step 5: Config.** `next.config.ts`: `output: 'export'`, `basePath: BASE` (from `NEXT_PUBLIC_BASE_PATH`, normalized inline because the config can't import app code), `images: { unoptimized: true }`. Keep `reactStrictMode`, `poweredByHeader`, and `allowedDevOrigins`; delete `headers()` and the header list. `layout.tsx` metadata: add `referrer: 'strict-origin-when-cross-origin'`. `package.json`: `"start": "npx serve@14 out"`.
- [ ] **Step 6: Call sites.** `stretch.ts`: `STRETCH_URL = withBase('/vendor/signalsmith-stretch-1.3.2.mjs')`. `Song.tsx` and `Studio.tsx`: build the share link with `absoluteUrl(origin, …)` instead of `${origin}/jam…`.
- [ ] **Step 7: Verify.** Temporarily move `app/api` aside, then run `NEXT_PUBLIC_BASE_PATH=/guitarpulse npm run build -w @guitarpulse/web`. Expect `apps/web/out/` to contain `index.html`, `coach.html`, `jam.html`, `404.html`, `.nojekyll`, and `vendor/signalsmith-stretch-1.3.2.mjs`. Expect `out/index.html` to reference `/guitarpulse/_next/`. (Task 2 deletes `app/api` for good. Restore it before committing.)
- [ ] **Step 8:** `npm run typecheck -w @guitarpulse/web` → no errors. Commit `feat(web): static export with configurable base path`.

### Task 2: Ask Claude from the browser

**Files:**
- Create: `apps/web/lib/claudeKey.ts`, `apps/web/lib/askClaude.ts`, `apps/web/test/askClaude.test.ts`
- Modify: `apps/web/features/Coach.tsx` (`ClaudeCoach`, about lines 402-470), `apps/web/lib/coachPrompt.ts` (`max_tokens: 900` → `4096`; Haiku 5.5 counts the same text as about 30% more tokens, and a cut-off tool call fails to parse), `apps/web/package.json` (add `"@anthropic-ai/sdk": "1.6.0"`)
- Delete: `apps/web/app/api/coach/route.ts`, `apps/web/.env.example`

**Interfaces:**
- Produces, in `lib/claudeKey.ts`:
  - `KEY_STORAGE_NAME = 'guitarpulse.anthropicKey'`
  - `cleanKey(raw: string): string | null`: trims the input; returns `null` unless the result starts with `sk-ant-` and contains no whitespace
  - `browserStorage(): Storage | null`: `window.localStorage`, or `null` when it's missing or access throws
  - `loadKey(storage: Storage | null): string | null`, `saveKey(storage: Storage | null, key: string): boolean` (`false` when it couldn't save), `forgetKey(storage: Storage | null): void`. None of them throw.
- Produces, in `lib/askClaude.ts`:
  - `type AskResult = { ok: true; advice: CoachAdvice } | { ok: false; message: string; badKey?: boolean }`
  - `askClaude(request: CoachRequest, apiKey: string, opts?: { fetch?: typeof fetch; maxRetries?: number; model?: string }): Promise<AskResult>`. Validates with `CoachRequestSchema` first. Calls `new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: opts.maxRetries ?? 1, timeout: 30_000, fetch: opts.fetch })` and then `client.messages.create(buildCoachRequest(…))`. Checks `stop_reason === 'refusal'` before `parseCoachResponse`. Maps SDK errors with `instanceof`, most specific first. The SDK is loaded with `await import('@anthropic-ai/sdk')` so it stays out of every other page's bundle.
- Messages (exact copy):
  - schema fails: `The session data was incomplete, so it was not sent to Claude.`
  - 401/403 (`badKey: true`): `Anthropic refused this API key. Check it or paste a new one.`
  - 402: `Your Anthropic account is out of credit. Add credit in the Claude Console, then try again.`
  - 429, 529, 5xx: `Claude is busy right now. Try again in a minute.`
  - timeout: `Claude took too long to answer. Try again.`
  - connection: `Could not reach Claude. Check your internet connection and try again.`
  - refusal: `Claude declined to answer this time. Your report above is unchanged.`
  - unparseable: `Claude’s answer came back in an unexpected shape. Try again.`
  - other status: `` `Claude could not answer (status ${status}).` ``

- [ ] **Step 1: Write failing tests** in `test/askClaude.test.ts`. Use a fake `fetch` that records calls and returns a `Response`, and pass `maxRetries: 0`.
  - `sends the coach request to the Messages API`: one call to `https://api.anthropic.com/v1/messages`. Header `x-api-key` equals the key, and header `anthropic-dangerous-direct-browser-access` is `true`. Body `model === 'claude-haiku-5-5'`, `tool_choice.name === 'coach_feedback'`, `max_tokens === 4096`.
  - `returns advice from a tool call`: 200 with a valid `coach_feedback` `tool_use` → `ok`, with the headline equal to the input.
  - `401 → badKey and /refused/`; `402 → /credit/`; `529 → /busy/`; `200 refusal → /declined/`; `fetch throws TypeError → /reach Claude/`; `200 with text only → /unexpected shape/`.
  - `rejects an invalid request without calling fetch`: `bpm: 999` → `/incomplete/` and zero fetch calls.
  - `cleanKey`: `'  sk-ant-abc \n'` → `'sk-ant-abc'`; `'hello'` → `null`; `'sk-ant-a b'` → `null`.
  - `storage that throws`: `saveKey` → `false`; `loadKey` → `null`; `forgetKey` doesn't throw. Use a stub whose methods all throw.
- [ ] **Step 2:** `npm install @anthropic-ai/sdk@1.6.0 -w @guitarpulse/web --save-exact`, then `npm test -w @guitarpulse/web` → the new tests FAIL (modules missing).
- [ ] **Step 3:** Implement `claudeKey.ts` and `askClaude.ts`, and set `max_tokens: 4096` in `coachPrompt.ts`. (`test/lib.test.ts` asserts the request body; update any `max_tokens` assertion there to match.)
- [ ] **Step 4:** `npm test -w @guitarpulse/web` → PASS.
- [ ] **Step 5: UI** in `ClaudeCoach`. On mount, read the key with `loadKey(browserStorage())`; the old `/api/coach` GET goes away.
  - **No key:** show the text `Paste your Anthropic API key to get a written lesson from these numbers. It is saved only in this browser and sent only to Anthropic.` Below it, a `type="password"` input labelled `Anthropic API key` and a **Save key** button. If `cleanKey` returns `null`, show `That doesn't look like an Anthropic API key. Keys start with sk-ant-.` If `saveKey` returns `false`, keep the key in memory and show `This browser blocked saving, so the key will be forgotten when you leave this page.`
  - **With a key:** show **Ask Claude** (as now) and a small **Forget key** button.
  - **On `badKey`:** show the message and the key field again.
- [ ] **Step 6:** Delete `app/api/coach/route.ts` and `.env.example`. `npm run typecheck -w @guitarpulse/web` → no errors. A build with the prefix succeeds with no `app/api` move-aside.
- [ ] **Step 7:** Commit `feat(web): Ask Claude runs in the browser with the user's own key`.

### Task 3: Deploy workflow, docs, local Pages check

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (Run it, production build, Ask Claude, a new "Live site" section), `packages/mcp-server/README.md` (`GUITARPULSE_APP_URL` → the Pages address)

- [ ] **Step 1: Workflow.** Triggers: `push` to `main` and `workflow_dispatch`. Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages` with `cancel-in-progress: false`.
  - **Job `build`** (ubuntu-latest): checkout → setup-node (24, npm cache) → configure-pages (`id: pages`) → `npm ci` → `npm run build -w @guitarpulse/core` → `npm test` → `npm run build -w @guitarpulse/web` with `NEXT_PUBLIC_BASE_PATH: ${{ steps.pages.outputs.base_path }}` → upload-pages-artifact (`path: apps/web/out`).
  - **Job `deploy`:** `needs: build`, `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`, runs deploy-pages (`id: deployment`).
  - Use the current major version of each action, checked against its releases at build time.
- [ ] **Step 2: Docs.** README: `npm run build` now writes static files to `apps/web/out`, previewed with `npm start -w @guitarpulse/web`. Ask Claude takes your own key in the coach card. The new "Live site" section covers the Pages setup and the Settings → Pages → GitHub Actions step. Connector README: set `GUITARPULSE_APP_URL` to `https://<user>.github.io/<repo>`.
- [ ] **Step 3: Local Pages check.** Build with `NEXT_PUBLIC_BASE_PATH=/guitarpulse`. Serve `out/` at `/guitarpulse/` with a small Node server that acts like Pages: `/x` serves `x.html`, `/dir/` serves `index.html`, a missing file serves `404.html` with status 404. In the browser, check each of the following with no console errors:
  - every nav item;
  - a direct load and a refresh of `/guitarpulse/coach`;
  - `/guitarpulse/jam?s=<link from the Song page Share button>` opens the session;
  - `/guitarpulse/vendor/signalsmith-stretch-1.3.2.mjs` returns 200;
  - the coach card shows the key field, and a dummy key `sk-ant-test-invalid` gets the refused-key message;
  - a missing page shows the app's 404.
- [ ] **Step 4:** Commit `ci: deploy to GitHub Pages on every push`.

### Task 4: Publish

- [ ] **Step 1:** The owner creates a public repo on GitHub (no README, so the first push is clean) and sets **Settings → Pages → Source** to **GitHub Actions**. Alternatively, the owner signs in to the GitHub CLI and Claude creates the repo.
- [ ] **Step 2:** `git remote add origin <url>` and `git push -u origin main`, after the owner confirms the repo URL.
- [ ] **Step 3:** The Actions run is green (check through the public GitHub API, or the owner checks the Actions tab). `https://<user>.github.io/<repo>/` loads, and a sub-page refresh works.
