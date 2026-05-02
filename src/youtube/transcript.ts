import { TranscriptSegment, VideoMeta } from "../shared/types";

const DEBUG_PREFIX = "[YAS transcript]";

export function extractVideoMeta(): VideoMeta {
  const title =
    document
      .querySelector(
        'meta[property="og:title"], meta[name="title"]'
      )
      ?.getAttribute("content") ??
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
      ?.textContent ??
    document.title;

  const channel =
    document
      .querySelector(
        "#owner #channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a"
      )
      ?.textContent?.trim() ??
    document
      .querySelector('span[itemprop="author"] link[itemprop="name"]')
      ?.getAttribute("content") ??
    "Unknown";

  const durationMeta = document
    .querySelector('meta[itemprop="duration"]')
    ?.getAttribute("content");
  let duration = "Unknown";
  if (durationMeta) {
    // Parse ISO 8601 duration like PT1H2M3S
    const m = durationMeta.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) {
      const parts: string[] = [];
      if (m[1]) parts.push(`${m[1]}h`);
      if (m[2]) parts.push(`${m[2]}m`);
      if (m[3]) parts.push(`${m[3]}s`);
      duration = parts.join(" ") || "0s";
    }
  }

  const url = window.location.href.split("&")[0]; // Clean URL

  return { title, channel, duration, url };
}

export async function extractTranscript(): Promise<TranscriptSegment[]> {
  debug("Starting transcript extraction");

  const existingSegments = readTranscriptSegments();
  if (existingSegments.length > 0) {
    debug("Using transcript segments already present in DOM", existingSegments);
    return existingSegments;
  }

  expandDescription();

  const showTranscriptButton = await waitForElement<HTMLButtonElement>(
    () => findShowTranscriptButton(),
    5000
  );
  if (!showTranscriptButton) {
    debug("Show transcript button not found");
    throw new Error("Show transcript button not found for this video.");
  }

  debug("Clicking Show transcript button", showTranscriptButton);
  showTranscriptButton.click();
  debug("Clicked Show transcript button");

  const segments = await waitForTranscriptSegments(10000);
  if (segments.length === 0) {
    debug("Transcript panel opened, but no transcript segments were extracted");
    throw new Error("Transcript panel opened, but no transcript text was found.");
  }

  debug("Extracted transcript segments", {
    count: segments.length,
    firstSegments: segments.slice(0, 5),
    textPreview: segments
      .slice(0, 10)
      .map((segment) => `${segment.timestamp ? `[${segment.timestamp}] ` : ""}${segment.text}`)
      .join("\n"),
  });

  return segments;
}

function expandDescription() {
  const description = document.querySelector<HTMLElement>(
    "ytd-watch-metadata #description, #description.item"
  );
  debug("Description element lookup", description);
  description?.click();
  if (description) debug("Clicked description element");

  const expandButton = document.querySelector<HTMLElement>(
    'tp-yt-paper-button#expand, #expand[role="button"]'
  );
  debug("Description expand button lookup", expandButton);
  expandButton?.click();
  if (expandButton) debug("Clicked description expand button");
}

function findShowTranscriptButton(): HTMLButtonElement | null {
  const transcriptSection = document.querySelector(
    "ytd-video-description-transcript-section-renderer"
  );
  const sectionButton = transcriptSection?.querySelector<HTMLButtonElement>(
    "button"
  );
  debug("Transcript section/button lookup", {
    transcriptSection,
    sectionButton,
    sectionButtonLabel: getButtonLabel(sectionButton),
  });
  if (sectionButton && isShowTranscriptButton(sectionButton)) {
    return sectionButton;
  }

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const matchingButton = buttons.find(isShowTranscriptButton) ?? null;
  debug("Fallback Show transcript button scan", {
    buttonCount: buttons.length,
    matchingButton,
    matchingButtonLabel: getButtonLabel(matchingButton),
  });
  return matchingButton;
}

function isShowTranscriptButton(button: HTMLButtonElement): boolean {
  const label = getButtonLabel(button)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return label.includes("show transcript") || label.includes("show transcription");
}

function getButtonLabel(button: HTMLButtonElement | null | undefined): string {
  if (!button) return "";
  return `${button.ariaLabel ?? ""} ${button.textContent ?? ""}`;
}

async function waitForTranscriptSegments(
  timeoutMs: number
): Promise<TranscriptSegment[]> {
  const segments = readTranscriptSegments();
  if (segments.length > 0) return segments;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const nextSegments = readTranscriptSegments();
      if (nextSegments.length > 0) {
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve(nextSegments);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(readTranscriptSegments());
    }, timeoutMs);
  });
}

function readTranscriptSegments(): TranscriptSegment[] {
  const renderers = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "transcript-segment-view-model",
        "macro-markers-panel-item-view-model transcript-segment-view-model",
        "ytd-transcript-segment-renderer",
        "yt-list-item-view-model:has(.segment-text)",
        "[data-target-id='PAmodern_transcript_view'] [class*='segment']",
      ].join(",")
    )
  );
  debug("Transcript segment renderer lookup", {
    rendererCount: renderers.length,
    firstRenderers: renderers.slice(0, 5),
  });

  const segments = renderers
    .map(readTranscriptSegment)
    .filter((segment): segment is TranscriptSegment => Boolean(segment));

  debug("Transcript segment parse result", {
    parsedCount: segments.length,
    firstSegments: segments.slice(0, 5),
  });

  return dedupeSegments(segments);
}

function readTranscriptSegment(renderer: HTMLElement): TranscriptSegment | null {
  if (renderer.matches("transcript-segment-view-model")) {
    return readModernTranscriptSegment(renderer);
  }

  const text =
    getText(renderer, [
      ".segment-text",
      "yt-formatted-string[class*='segment-text']",
      "#content-text",
      "[class*='segment-text']",
    ]) ?? "";
  if (!text) return null;

  const timestamp =
    getText(renderer, [
      ".segment-timestamp",
      "#timestamp",
      "[class*='timestamp']",
    ]) ?? undefined;

  return { timestamp, text };
}

function readModernTranscriptSegment(
  renderer: HTMLElement
): TranscriptSegment | null {
  const timestamp = getText(renderer, [
    ".ytwTranscriptSegmentViewModelTimestamp",
  ]) ?? undefined;

  const text =
    getText(renderer, [
      ".ytAttributedStringHost[role='text']",
      "span[role='text']",
    ]) ?? "";

  if (!text) return null;
  return { timestamp, text };
}

function getText(root: HTMLElement, selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = root.matches(selector)
      ? root
      : root.querySelector<HTMLElement>(selector);
    const text = element?.textContent?.trim();
    if (text) return text.replace(/\s+/g, " ");
  }
  return null;
}

function dedupeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const seen = new Set<string>();
  return segments.filter((segment) => {
    const key = `${segment.timestamp ?? ""}\n${segment.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function waitForElement<T extends HTMLElement>(
  findElement: () => T | null,
  timeoutMs: number
): Promise<T | null> {
  const existing = findElement();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = findElement();
      if (element) {
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(findElement());
    }, timeoutMs);
  });
}

function debug(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.debug(DEBUG_PREFIX, message);
    return;
  }
  console.debug(DEBUG_PREFIX, message, payload);
}
