import { Settings } from "./types";

export const DEFAULT_PROMPT_TEMPLATE = `Extract the transcript of this YouTube video from the following URL: {url} and summarize it in {responseLanguage}. Extract key points with timestamps.`;

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
