import { Settings } from "./types";

export const DEFAULT_PROMPT_TEMPLATE = `You are given a YouTube video transcript in its original language.

Summarize the video in {responseLanguage}.

Video title: {title}
Channel: {channel}
Duration: {duration}
URL: {url}

Transcript:
{transcript}`;

export const DEFAULT_SETTINGS: Settings = {
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  responseLanguage: "English",
  includeTimestamps: false,
  includeSpeakerLabels: false,
  allowAutomation: true,
  autoSubmit: {
    chatgpt: false,
    claude: false,
    gemini: false,
    deepseek: false,
  },
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  return stored as unknown as Settings;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}
