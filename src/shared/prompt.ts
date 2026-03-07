import { Settings, TranscriptSegment, VideoMeta } from "./types";

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTranscript(
  segments: TranscriptSegment[],
  settings: Settings
): string {
  return segments
    .map((seg) => {
      const parts: string[] = [];
      if (settings.includeTimestamps) {
        parts.push(`[${formatTimestamp(seg.startMs)}]`);
      }
      if (settings.includeSpeakerLabels && seg.speaker) {
        parts.push(`${seg.speaker}:`);
      }
      parts.push(seg.text);
      return parts.join(" ");
    })
    .join("\n");
}

export function buildPrompt(
  meta: VideoMeta,
  segments: TranscriptSegment[],
  settings: Settings,
  transcriptOverride?: string
): string {
  const transcript = transcriptOverride ?? formatTranscript(segments, settings);
  return settings.promptTemplate
    .replace(/\{title\}/g, meta.title)
    .replace(/\{channel\}/g, meta.channel)
    .replace(/\{duration\}/g, meta.duration)
    .replace(/\{url\}/g, meta.url)
    .replace(/\{responseLanguage\}/g, settings.responseLanguage)
    .replace(/\{transcript\}/g, transcript);
}
