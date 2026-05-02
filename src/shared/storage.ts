import { Settings } from "./types";

export const DEFAULT_PROMPT_TEMPLATE = `Summarize this YouTube video in {responseLanguage}. Extract key points with timestamps.

Title: {title}
Channel: {channel}
Duration: {duration}
URL: {url}

Transcript:
{transcript}`;

export const DEFAULT_SETTINGS: Settings = {
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  responseLanguage: "English",
  allowAutomation: true,
  autoSubmit: {
    gemini: false,
  },
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  return stored as unknown as Settings;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}
