import { TranscriptSegment, VideoMeta, Settings } from "./types";
import { buildPrompt, formatTranscript } from "./prompt";
import { ProviderDef } from "./providers";

export interface ChunkInfo {
  chunkIndex: number;
  totalChunks: number;
  prompt: string;
}

export function estimatePromptLength(
  meta: VideoMeta,
  segments: TranscriptSegment[],
  settings: Settings
): number {
  return buildPrompt(meta, settings, formatTranscript(segments)).length;
}

export function needsChunking(
  meta: VideoMeta,
  segments: TranscriptSegment[],
  settings: Settings,
  provider: ProviderDef
): boolean {
  return estimatePromptLength(meta, segments, settings) > provider.maxChars;
}

export function chunkTranscript(
  meta: VideoMeta,
  segments: TranscriptSegment[],
  settings: Settings,
  provider: ProviderDef
): ChunkInfo[] {
  const fullTranscript = formatTranscript(segments);
  const templateWithoutTranscript = buildPrompt(meta, settings, "");
  const overhead = templateWithoutTranscript.length + 200;
  const chunkSize = Math.max(provider.maxChars - overhead, 1000);

  const lines = fullTranscript.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > chunkSize && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);

  const totalChunks = chunks.length;
  return chunks.map((chunkText, i) => {
    const header =
      totalChunks > 1
        ? `[Part ${i + 1} of ${totalChunks}] ` +
          (i === 0
            ? "I will send the transcript in multiple parts. Please wait for all parts before summarizing.\n\n"
            : i === totalChunks - 1
            ? "This is the final part. You now have the complete transcript. Please summarize.\n\n"
            : "Here is the next part of the transcript.\n\n")
        : "";
    const transcript = header + chunkText;
    return {
      chunkIndex: i,
      totalChunks,
      prompt: buildPrompt(meta, settings, transcript),
    };
  });
}
