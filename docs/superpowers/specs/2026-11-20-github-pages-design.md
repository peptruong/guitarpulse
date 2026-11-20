# GuitarPulse on GitHub Pages (short design)

Date: 2026-11-20. Size: a small change.

## Why

Today the app only runs while `npm run dev` is open in a terminal, and the phone reaches it at a
plain `http://` home-network address, where browsers block the microphone. The goal is an `https://` address
that opens on any device at any time, with no server to run or pay for, and that updates itself
when new code is pushed.

## Goals, non-goals, anti-goals

- **Goals:** `apps/web` builds to plain files; GitHub Pages hosts them; every push to `main`
  redeploys on its own; the mic works on the phone; Claude's jam links can point at the hosted app.
- **Non-goals:** offline or installable app, custom domain, accounts or cloud sync, changes to
  the music engine or to features.
- **Anti-goals:** anything that needs a server or a monthly bill; an API key in the repo or in
  the built files.

## Constraints

- GitHub Pages serves files only: no API routes, no custom response headers.
- A project site lives under `/<repo-name>/`, so every path the app builds by hand needs that prefix.
- On GitHub's free plan the repo must be public for Pages to work.
- Every Pages site on one account shares the origin `https://<user>.github.io`, so browser
  storage (where the Claude key would sit) is shared with the account's other Pages sites.

## Approaches

| Approach | Trade-off |
|---|---|
| **GitHub Pages (chosen)** | Free, redeploys on every push, standard setup. Needs a GitHub account; code is public on the free plan. |
| Claude artifact | Live today with no new accounts and private by default, but the mic and audio worklets are untested in Claude's sandbox, and it only updates when republished. |
| Cloudflare Pages | Same as GitHub Pages and can keep the code private, but needs one more account. |

## Design (Claude's calls unless marked)

1. **Host: GitHub Pages** (the owner's choice), deployed by GitHub Actions.
2. **Static build.** `output: 'export'` in `apps/web/next.config.ts`. The base path comes from an
   environment variable that the deploy workflow fills in from the repo name, so the repo can be
   called anything. Local `npm run dev` keeps working at `http://localhost:3000` with no prefix.
3. **Ask Claude moves into the browser.** Delete `app/api/coach/route.ts`. The "Claude's take" card
   gets a field to paste an Anthropic API key. The key is saved in this browser only and sent only to
   `api.anthropic.com`. The request builder and reply checks in `lib/coachPrompt.ts` are reused
   as they are.
4. **Hand-built paths get the prefix:** the time-stretcher module (`lib/audio/stretch.ts`) and
   the share links in `features/Song.tsx` and `features/Studio.tsx`. Next.js adds the prefix to
   `<Link>` and router calls by itself.
5. **Headers.** GitHub Pages can't send the security headers in `next.config.ts`. The referrer
   policy moves to a meta tag. The others are dropped. The mic still works because a page
   may use it on its own origin by default.
6. **Deploy workflow** `.github/workflows/deploy.yml`: on each push to `main` (or a manual run),
   it installs, runs the tests, builds, and publishes. If a test fails, nothing is published, so
   the live site keeps the last working version.
7. **Repo.** The main local working copy becomes the git repo. It matches the shared zip except
   for the phone dev-server line, which stays. Add `apps/web/out/` to `.gitignore`.
8. **Docs.** Update the README's run, build, and Ask Claude sections. Tell the connector README
   to set `GUITARPULSE_APP_URL` to the Pages address.

## The owner's part

Create the GitHub repo (or sign in to the GitHub CLI and let Claude create it). Then, once,
set **Settings → Pages → Source** to **GitHub Actions**.

## Testing

Run the existing tests and the typecheck. Build with the prefix `/guitarpulse`, then serve the
result the way GitHub Pages does. Open every page directly and through the menu. Also check a jam
link, that the time-stretcher module loads, and the Ask Claude error message with a dummy key.

## Left to the builder

Exact UI wording, the Node version in CI, and the versions of the GitHub Actions used.
