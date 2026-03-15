import { Settings, VideoMeta } from "./types";

export function buildPrompt(
  meta: VideoMeta,
  settings: Settings
): string {
  return settings.promptTemplate
    .replace(/\{title\}/g, meta.title)
    .replace(/\{channel\}/g, meta.channel)
    .replace(/\{duration\}/g, meta.duration)
    .replace(/\{url\}/g, meta.url)
    .replace(/\{responseLanguage\}/g, settings.responseLanguage);
}
