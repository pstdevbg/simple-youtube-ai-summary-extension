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
    chatgpt: false,
    claude: false,
    gemini: false,
    deepseek: false,
    grok: false,
  },
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
  const settings = stored as unknown as Settings;
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    autoSubmit: {
      ...DEFAULT_SETTINGS.autoSubmit,
      ...settings.autoSubmit,
    },
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}
