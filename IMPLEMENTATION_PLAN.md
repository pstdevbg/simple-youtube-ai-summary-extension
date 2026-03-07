# YouTube Transcript Summarizer Extension Plan

## Goal

Build a Chromium extension in plain TypeScript that adds a native-looking panel to the YouTube watch page inside the `#secondary` column. The panel lets the user:

- extract the full video transcript in its original language
- include optional timestamps and speaker labels
- copy the transcript
- copy the final AI prompt
- send the prompt to ChatGPT, Claude, Gemini, or DeepSeek
- optionally auto-inject the prompt into the AI site input and auto-submit it

All processing stays local in the browser. No backend is involved.

## Agreed Product Decisions

### Stack

- Manifest V3
- plain TypeScript
- no React or other UI framework
- `chrome.storage.sync` for settings
- **esbuild** for building — fast, minimal config, handles multiple entry points well (webpack/rollup would be overkill for plain TS)

### YouTube behavior

- the panel appears automatically on every YouTube watch page
- the panel is inserted into the `id="secondary"` area
- the panel should visually match YouTube as closely as practical

### Transcript behavior

- use the transcript in the original language provided by YouTube
- support transcript extraction even when the visible YouTube transcript panel is not opened by the user
- include timestamps and speaker labels as optional settings
- if no transcript is available, show a clear error and suggested next steps

#### Transcript extraction approach

Primary path (recommended):

1. Parse `ytInitialPlayerResponse` (or the equivalent `ytInitialData` / player response JSON embedded in the page) to locate the `captionTracks` array inside `playerCaptionsTracklistRenderer`.
2. Pick the first available caption track (preferring manual captions over auto-generated when both exist).
3. Fetch the timed-text XML endpoint from the track's `baseUrl`.
4. Parse the XML response into normalized transcript segments with text, start time, and duration.

This approach works without opening the YouTube transcript panel, is available on page load, and covers both manual and auto-generated captions.

Fallback path:

- If `ytInitialPlayerResponse` is unavailable (e.g. YouTube changes its page structure), attempt to extract caption data from the `/youtubei/v1/player` innertube API using the video ID.

Do **not** rely on scraping the visible transcript panel DOM — it requires user interaction to open and is less reliable.

### Prompt behavior

- one shared prompt template for all providers
- supported placeholders:
  - `{title}`
  - `{url}`
  - `{channel}`
  - `{duration}`
  - `{transcript}`
  - `{responseLanguage}`
- default prompt intent is summarization
- the prompt should explicitly instruct the AI to answer in the user-selected response language while keeping the transcript in its native language

### AI provider behavior

- providers:
  - ChatGPT: `chatgpt.com`
  - Claude: `claude.ai`
  - Gemini: `gemini.google.com`
  - DeepSeek: `chat.deepseek.com`
- each provider gets its own auto-submit checkbox in settings
- clicking a provider button should:
  1. build the final prompt
  2. copy it to clipboard
  3. open the provider in a new tab
  4. if host permission is granted and automation is enabled, try to inject the prompt into the input and submit it
- if permission is not granted or automation fails, the user still has the copied prompt and can paste manually

### Permissions UX

- request AI-site host permissions only when needed for automation
- explain clearly that:
  - with permission: the extension can auto-fill and optionally auto-submit on supported AI sites
  - without permission: the extension still works, but only with copy-to-clipboard plus opening the site
- YouTube functionality should work regardless of whether AI-site permissions are granted

### Long transcript behavior

- if the prompt is likely too long for a provider, warn the user
- split the transcript into chunks
- provide a chunked send flow so the user can send part 1, part 2, etc.
- chunking should happen locally
- when automation is enabled, offer a "Send All Chunks" mode that auto-sends subsequent chunks with a short delay between them
- when automation is not available, provide sequential "Copy Chunk N" buttons to reduce manual effort

## Proposed Extension Architecture

## 1. Core pieces

- `manifest.json`
- YouTube content script
- AI-site content scripts for provider automation
- service worker for tab coordination and permission flow
- options page for settings
- shared TypeScript modules for transcript parsing, prompt building, chunking, storage, and provider definitions

## 2. Main modules

### `src/shared/types.ts`

Defines:

- provider ids
- settings shape
- transcript segment shape
- prompt payload shape
- automation request messages

### `src/shared/storage.ts`

Handles:

- default settings
- reading and writing `chrome.storage.sync`
- migration support for future settings changes

### `src/shared/providers.ts`

Contains:

- provider metadata
- site URLs
- permission origins
- rough input-length thresholds
- provider-specific notes for automation

### `src/shared/prompt.ts`

Handles:

- placeholder interpolation
- response language injection
- transcript formatting with optional timestamps and speaker labels
- chunk prompt generation

### `src/shared/chunking.ts`

Handles:

- transcript length estimation
- chunk splitting
- chunk labels and sequencing
- provider-specific warning thresholds

### `src/youtube/transcript.ts`

Handles:

- extracting video metadata from the watch page (title, channel, duration from `ytInitialPlayerResponse` or DOM)
- locating the `captionTracks` array from `playerCaptionsTracklistRenderer` in the embedded player response JSON
- selecting the best available track (prefer manual captions over auto-generated)
- fetching the timed-text XML endpoint from the track's `baseUrl`
- parsing the XML into normalized `TranscriptSegment[]` with text, start time, duration, and optional speaker label
- fallback: requesting caption data via `/youtubei/v1/player` innertube API if the embedded JSON is unavailable

### `src/youtube/panel.ts`

Handles:

- injecting the panel into `#secondary`
- rendering loading, success, warning, and error states
- rendering buttons:
  - Copy Transcript
  - Copy Prompt
  - ChatGPT
  - Claude
  - Gemini
  - DeepSeek
- rendering transcript/chunk warnings

### `src/youtube/index.ts`

Handles:

- watch-page route changes on YouTube SPA navigation
- panel mount and cleanup
- transcript refresh when the video changes

### `src/ai/<provider>.ts`

Handles per-provider automation:

- detect composer input
- inject prompt text using DOM events compatible with the site
- optionally click submit
- report granular status back to the extension:
  - `injected` — text was placed in the input but submit was not attempted
  - `submitted` — text was injected and submit was triggered
  - `partial` — text was injected but submit button was not found (user should submit manually)
  - `failed` — input element was not found (user should paste from clipboard)

### `src/background/index.ts`

Handles:

- opening provider tabs
- checking/requesting optional host permissions
- relaying payloads to AI-site content scripts
- fallback behavior if permission is denied

### `src/options/index.ts`

Handles settings UI for:

- prompt template
- response language
- include timestamps
- include speaker labels
- per-provider auto-submit toggles
- allow automation toggle
- chunking behavior text and permission explanation

## 3. Manifest design

### Required permissions

- `storage`
- `activeTab`
- `scripting`

Note: `clipboardWrite` is **not needed** — `navigator.clipboard.writeText()` works in content scripts when triggered by a user gesture (button click). One fewer permission to request.

Note: `tabs` is **not used** — it grants access to all tab URLs and titles, which is unnecessarily broad. `chrome.tabs.create()` (to open provider tabs) does not require the `tabs` permission. `activeTab` is sufficient for the actual use cases and is less alarming to users.

### Host permissions

- always:
  - `https://www.youtube.com/*`
- optional:
  - `https://chatgpt.com/*`
  - `https://claude.ai/*`
  - `https://gemini.google.com/*`
  - `https://chat.deepseek.com/*`

Use `optional_host_permissions` for AI sites so the extension can work without them.

## UX Flows

## 1. Normal transcript copy flow

1. User opens a YouTube watch page.
2. The panel appears in `#secondary`.
3. Extension loads transcript and metadata.
4. User clicks `Copy Transcript`.
5. Transcript is copied in the configured format.

## 2. AI send flow with permissions granted

1. User clicks a provider button.
2. Extension builds the prompt and copies it to clipboard.
3. Extension opens the provider tab.
4. If automation permission exists and automation is enabled:
   - inject prompt into provider input
   - auto-submit if that provider's checkbox is enabled
5. Panel shows success or fallback status.

## 3. AI send flow without permissions granted

1. User clicks a provider button.
2. Extension builds the prompt and copies it to clipboard.
3. Extension opens the provider tab.
4. Extension informs the user that auto-fill is unavailable until permission is granted.
5. User pastes manually.

## 4. Permission request flow

1. User clicks a provider button with automation enabled.
2. If permission is missing, show a concise explanation dialog.
3. User can:
   - allow permission now
   - continue without permission
4. If allowed, proceed with automation.
5. If denied, keep copy + open-site fallback.

## 5. Long transcript flow

1. Extension estimates prompt size.
2. If over threshold, show a warning in the panel.
3. Offer chunked actions:
   - Copy Chunk 1
   - Send Chunk 1 to ChatGPT
   - next chunk actions after that
4. Label each chunk clearly so the AI can process them sequentially.

## Default Settings

- response language: `English`
- include timestamps: `false`
- include speaker labels: `false`
- allow automation on AI sites: `true`
- auto-submit:
  - ChatGPT: `false`
  - Claude: `false`
  - Gemini: `false`
  - DeepSeek: `false`

Default prompt template:

```text
You are given a YouTube video transcript in its original language.

Summarize the video in {responseLanguage}.

Video title: {title}
Channel: {channel}
Duration: {duration}
URL: {url}

Transcript:
{transcript}
```

## Technical Risks

## 1. AI site DOM instability

Provider page markup changes often. Automation must be best-effort and isolated behind provider-specific adapters.

Mitigation:

- keep selectors centralized per provider
- dispatch native input events after injection
- fail safely to clipboard fallback

## 2. YouTube transcript extraction variability

Some videos do not expose transcripts uniformly.

Mitigation:

- prefer structured caption data over transcript-panel scraping
- support multiple extraction paths
- show actionable error states

## 3. Input size limits

Providers have different practical limits.

Mitigation:

- estimate prompt size before send
- warn early
- implement chunking

## 4. SPA navigation on YouTube

YouTube changes routes without full page reloads.

Mitigation:

- observe URL changes and page mutations
- remount panel and refresh state on watch-page transitions

## Implementation Phases

## Phase 1

- scaffold MV3 TypeScript project
- add esbuild as the build tool with watch mode and multiple entry points
- create manifest
- add YouTube content script mount
- add options page
- implement settings storage

## Phase 2

- implement video metadata extraction
- implement transcript extraction and normalization
- render YouTube-native panel
- support copy transcript and copy prompt

## Phase 3

- implement provider definitions and background messaging
- implement permission request UX
- open provider tabs and clipboard fallback

## Phase 4

- implement provider automation scripts
- add optional auto-submit per provider
- add granular automation status reporting (`injected`, `submitted`, `partial`, `failed`)
- surface automation status in the YouTube panel so the user knows whether to paste manually

## Phase 5

- implement long-prompt detection
- implement chunking UI and chunk prompt generation
- add "Send All Chunks" mode for automated sequential sending when provider permission is granted
- refine settings and language behavior

## Testing Plan

### Manual test matrix

- YouTube video with manual captions
- YouTube video with auto-generated captions
- YouTube video with no transcript
- non-English transcript with response language set to English
- response language changed to another language
- each AI provider:
  - no permission granted
  - permission granted
  - automation enabled
  - automation disabled
  - auto-submit on
  - auto-submit off
- long transcript requiring chunking
- YouTube SPA navigation between videos

### What success looks like

- panel renders consistently on watch pages
- transcript extraction works without opening YouTube transcript UI manually
- settings persist via sync storage
- fallback always works through clipboard + opened tab
- granted permissions enable best-effort automation without breaking fallback

## Open Implementation Detail To Finalize During Build

- provider-specific selectors and submission mechanics on current AI sites (these change frequently and must be verified against live sites during development)
- chunk size thresholds per provider based on real-world input acceptance
- exact shape of the `ytInitialPlayerResponse` → `captionTracks` path (verify against real watch pages early in Phase 2 before building UI)
