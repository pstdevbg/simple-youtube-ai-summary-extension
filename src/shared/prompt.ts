import { Settings, TranscriptSegment, VideoMeta } from "./types";

export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const text = segment.text.trim();
      if (!text) return "";
      return segment.timestamp ? `[${segment.timestamp}] ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildPrompt(
  meta: VideoMeta,
  settings: Settings,
  transcript = ""
): string {
  const template = settings.promptTemplate.includes("{transcript}")
    ? settings.promptTemplate
    : `${settings.promptTemplate}\n\nTranscript:\n{transcript}`;

  return template
    .replace(/\{title\}/g, meta.title)
    .replace(/\{channel\}/g, meta.channel)
    .replace(/\{duration\}/g, meta.duration)
    .replace(/\{url\}/g, meta.url)
    .replace(/\{transcript\}/g, transcript)
    .replace(/\{responseLanguage\}/g, settings.responseLanguage);
}
