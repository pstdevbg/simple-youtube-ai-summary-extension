import { ProviderId } from "./types";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  url: string;
  origin: string;
  maxChars: number;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  gemini: {
    id: "gemini",
    label: "Gemini",
    url: "https://gemini.google.com/app",
    origin: "https://gemini.google.com/*",
    maxChars: 90000,
  },
};

export const PROVIDER_IDS: ProviderId[] = [
  "gemini",
];
