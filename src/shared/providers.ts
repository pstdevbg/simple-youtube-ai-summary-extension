import { ProviderId } from "./types";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  url: string;
  origin: string;
  maxChars: number;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    origin: "https://chatgpt.com/*",
    maxChars: 25000,
  },
  claude: {
    id: "claude",
    label: "Claude",
    url: "https://claude.ai/new",
    origin: "https://claude.ai/*",
    maxChars: 90000,
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    url: "https://gemini.google.com/app",
    origin: "https://gemini.google.com/*",
    maxChars: 90000,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    url: "https://chat.deepseek.com/",
    origin: "https://chat.deepseek.com/*",
    maxChars: 30000,
  },
};

export const PROVIDER_IDS: ProviderId[] = [
  "chatgpt",
  "claude",
  "gemini",
  "deepseek",
];
