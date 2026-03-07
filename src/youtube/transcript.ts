import { TranscriptSegment, VideoMeta } from "../shared/types";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
}

function getPlayerResponse(): any | null {
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    const text = script.textContent ?? "";
    const match = text.match(
      /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s
    );
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // continue
      }
    }
  }

  // Fallback: try window variable
  try {
    return (window as any).ytInitialPlayerResponse ?? null;
  } catch {
    return null;
  }
}

function getCaptionTracks(playerResponse: any): CaptionTrack[] {
  try {
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(tracks)) return tracks;
  } catch {
    // ignore
  }
  return [];
}

function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  // Prefer manual captions over auto-generated
  const manual = tracks.find((t) => t.kind !== "asr");
  return manual ?? tracks[0];
}

function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

async function fetchTimedText(
  baseUrl: string
): Promise<TranscriptSegment[]> {
  // Request JSON format
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch captions: ${res.status}`);

  const data = await res.json();
  const events: any[] = data.events ?? [];
  const segments: TranscriptSegment[] = [];

  for (const ev of events) {
    // Skip events without text segments
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s: any) => s.utf8 ?? "")
      .join("")
      .trim();
    if (!text || text === "\n") continue;

    segments.push({
      text: decodeHtmlEntities(text),
      startMs: ev.tStartMs ?? 0,
      durationMs: ev.dDurationMs ?? 0,
      speaker: undefined,
    });
  }
  return segments;
}

async function fetchTimedTextXml(
  baseUrl: string
): Promise<TranscriptSegment[]> {
  const res = await fetch(baseUrl);
  if (!res.ok) throw new Error(`Failed to fetch captions: ${res.status}`);
  const xmlText = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const texts = doc.querySelectorAll("text");
  const segments: TranscriptSegment[] = [];

  for (const node of texts) {
    const rawText = node.textContent?.trim();
    if (!rawText) continue;
    const start = parseFloat(node.getAttribute("start") ?? "0") * 1000;
    const dur = parseFloat(node.getAttribute("dur") ?? "0") * 1000;
    segments.push({
      text: decodeHtmlEntities(rawText),
      startMs: start,
      durationMs: dur,
      speaker: undefined,
    });
  }
  return segments;
}

export async function extractTranscript(): Promise<TranscriptSegment[]> {
  const playerResponse = getPlayerResponse();
  if (!playerResponse) {
    throw new Error(
      "Could not find video data. Try refreshing the page."
    );
  }

  const tracks = getCaptionTracks(playerResponse);
  if (tracks.length === 0) {
    throw new Error(
      "No captions available for this video. The creator may not have added subtitles."
    );
  }

  const track = selectBestTrack(tracks)!;

  // Try JSON format first, fall back to XML
  try {
    const segments = await fetchTimedText(track.baseUrl);
    if (segments.length > 0) return segments;
  } catch {
    // fall through to XML
  }

  return fetchTimedTextXml(track.baseUrl);
}

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
