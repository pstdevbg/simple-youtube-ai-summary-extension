# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — production build (minified) into `dist/`
- `npm run watch` — esbuild rebuild-on-change, non-minified (use this during development)
- `npm run typecheck` — `tsc --noEmit` against `src/**/*.ts`
- `npm run package` — build + copy `public/*` into `dist/` (the `build` script already does the copy via `build.mjs`, so `package` is mostly redundant)

There is no test runner, linter, or formatter configured. Type-check via `tsc` is the only static gate.

To load the extension: `chrome://extensions` → enable Developer mode → "Load unpacked" → select `dist/`. After a rebuild, click the reload button on the extension card; YouTube tabs need a refresh to pick up content-script changes.

## Architecture

This is a Manifest V3 Chromium extension with **no framework, no bundler config beyond `build.mjs`, and no backend**. Runtime contexts are bundled as separate IIFEs by esbuild and emitted into `dist/`:

| Entry point (in `build.mjs`)  | Runs in                                  | Loaded by                                              |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `src/youtube/index.ts`        | Content script on `https://www.youtube.com/*` | `manifest.json` `content_scripts`                      |
| `src/background/index.ts`     | Service worker                           | `manifest.json` `background.service_worker`            |
| `src/options/index.ts`        | Options page                             | `public/options/options.html`                          |
| `src/ai/<provider>.ts`        | Injected into the AI provider tab on demand | `chrome.scripting.executeScript` from background    |

**Adding a new entry point requires editing `build.mjs`** — there is no glob.

### The provider abstraction

There is a generic provider system (`src/shared/providers.ts`, `ProviderId` in `types.ts`, `PROVIDER_IDS` iteration in panel/options). The active providers are ChatGPT, Claude, Gemini, DeepSeek, and Grok. Each provider needs a `src/ai/<id>.ts` adapter because provider UIs use different input and submit button markup.

To add another provider you must touch all of: `ProviderId` union (`types.ts`), `PROVIDERS` map and `PROVIDER_IDS` (`providers.ts`), `DEFAULT_SETTINGS.autoSubmit` (`storage.ts`), the `optional_host_permissions` array in `public/manifest.json`, the options HTML (a new `autoSubmit-<id>` checkbox), `build.mjs` entry points, and a new `src/ai/<id>.ts` adapter that listens for `AUTOMATION_REQUEST` messages.

### Message flow for "Summarize with <provider>"

1. Content script (`youtube/panel.ts`) builds the prompt and `chrome.runtime.sendMessage({ type: "OPEN_PROVIDER", ... })`.
2. Background (`background/index.ts`) requests/checks the optional host permission when automation is enabled, opens the provider tab, waits for `tabs.onUpdated` `complete`, then `chrome.scripting.executeScript({ files: ["ai/<provider>.js"] })`.
3. The injected adapter receives `AUTOMATION_REQUEST` via `chrome.runtime.onMessage`, finds the contenteditable input, injects text + dispatches `input`/`change` events, optionally clicks send, and returns an `AutomationStatus`.
4. Background relays the result back to the panel via the original `sendMessage` callback.

Without the optional host permission, status comes back as `"no-permission"` and the user pastes manually from clipboard (the panel always copies first).

### Transcript extraction

`src/youtube/transcript.ts` does **not** parse `ytInitialPlayerResponse` (the README is out of date on this point). It clicks YouTube's own "Show transcript" button in the description and scrapes `transcript-segment-view-model` (and several legacy fallback selectors) from the DOM via `MutationObserver`, with a 10s timeout. This means transcripts only work on videos that expose the Show transcript button in their UI; auto-generated-only videos without that button will fail.

The extraction is lazy — `panel.ts` only calls `extractTranscript()` when the user clicks Copy/Summarize, and caches the promise per video.

### SPA navigation

`youtube/index.ts` listens to YouTube's `yt-navigate-finish` custom event (plus `popstate` as a fallback) and tracks the last-seen `?v=` to avoid re-rendering the panel on the same video. `removePanel()` is called when navigating off `/watch`.

### Settings & storage

All settings live in `chrome.storage.sync` with the shape defined by `Settings` in `src/shared/types.ts`. `loadSettings()` in `storage.ts` uses `chrome.storage.sync.get(DEFAULT_SETTINGS)` so missing keys fall back to defaults — when adding a new field, also add it to `DEFAULT_SETTINGS`.

### Chunking

`src/shared/chunking.ts` exists and computes prompts split by `provider.maxChars`, but **it is not currently called from `panel.ts`** — the panel always builds a single prompt regardless of length. If long-transcript handling is requested, this is the wiring gap to close.

## Project conventions

- **TypeScript strict mode is on** (`tsconfig.json`). Don't add `any` casts to silence the type checker; fix the type.
- The codebase uses no framework — DOM is built with `document.createElement` and class-based CSS in `public/youtube/panel.css`. Don't introduce React or a build step.
- Module format is `commonjs` in `package.json`, but esbuild emits IIFE bundles for the extension contexts. Source files are ESM TypeScript.
- README is partially stale (mentions ChatGPT/Claude/DeepSeek and `ytInitialPlayerResponse` parsing). Trust the code over the README when they disagree.
