# YouTube AI Summary

A Chromium extension that extracts YouTube video transcripts and sends them to AI providers for summarization. All processing happens locally in the browser — no backend required.

## Features

- Adds a native-looking panel to every YouTube watch page
- Extracts transcripts automatically (no need to open YouTube's transcript panel)
- Prefers manual captions over auto-generated when both exist
- Copy transcript or the full AI prompt to clipboard
- Send prompts directly to ChatGPT, Claude, Gemini, or DeepSeek
- Optional auto-fill and auto-submit on AI sites (requires granting site permission)
- Automatic chunking for long transcripts that exceed provider limits
- Customizable prompt template with placeholders
- Configurable response language, timestamps, and speaker labels
- Supports YouTube SPA navigation between videos
- Dark mode support matching YouTube's theme

## Install

```sh
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension in `chrome://extensions` (enable Developer mode first).

## Development

```sh
npm run watch     # rebuild on file changes
npm run typecheck # run TypeScript type checker
```

## Project Structure

```
src/
  shared/
    types.ts        Type definitions
    storage.ts      chrome.storage.sync with defaults
    providers.ts    AI provider metadata and thresholds
    prompt.ts       Template interpolation and transcript formatting
    chunking.ts     Long transcript splitting
  youtube/
    transcript.ts   Transcript extraction via ytInitialPlayerResponse
    panel.ts        UI panel in YouTube's #secondary column
    index.ts        SPA navigation handling
  ai/
    chatgpt.ts      ChatGPT automation adapter
    claude.ts       Claude automation adapter
    gemini.ts       Gemini automation adapter
    deepseek.ts     DeepSeek automation adapter
  background/
    index.ts        Tab management, permissions, script injection
  options/
    index.ts        Settings page logic
public/
  manifest.json     Manifest V3
  options/           Settings HTML
  youtube/           Panel CSS
```

## How It Works

1. On any YouTube watch page, the extension parses `ytInitialPlayerResponse` to find caption tracks.
2. It fetches the timed-text endpoint and builds a formatted transcript.
3. The panel appears in the sidebar with copy and send buttons.
4. Clicking a provider button copies the prompt and opens the AI site. If you've granted the optional host permission, the extension can also auto-paste (and optionally auto-submit) the prompt.
5. If a transcript is too long for a provider's input limit, it splits into labeled chunks that the AI can process sequentially.

## Permissions

**Required:**
- `storage` — persist settings
- `activeTab` — interact with the current tab
- `scripting` — inject automation scripts into AI sites
- `https://www.youtube.com/*` — read video data and show the panel

**Optional (requested on demand):**
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://chat.deepseek.com/*`

Optional permissions enable auto-fill on AI sites. Without them, the extension still works via copy-to-clipboard.

## Settings

Open the extension options page to configure:

- **Response language** — language the AI should respond in (default: English)
- **Include timestamps** — add `[0:00]` markers to transcript lines
- **Include speaker labels** — add speaker names when available
- **Prompt template** — customizable with `{title}`, `{channel}`, `{duration}`, `{url}`, `{transcript}`, `{responseLanguage}`
- **Auto-fill** — enable/disable AI site automation
- **Auto-submit** — per-provider toggle to also click the send button

## Stack

- Manifest V3
- TypeScript (no framework)
- esbuild

## License

ISC
