export type ProviderId = "chatgpt" | "claude" | "gemini" | "deepseek";

export interface Settings {
  promptTemplate: string;
  responseLanguage: string;
  includeTimestamps: boolean;
  includeSpeakerLabels: boolean;
  allowAutomation: boolean;
  autoSubmit: Record<ProviderId, boolean>;
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  durationMs: number;
  speaker?: string;
}

export interface VideoMeta {
  title: string;
  channel: string;
  duration: string;
  url: string;
}

export interface PromptPayload {
  meta: VideoMeta;
  transcript: TranscriptSegment[];
  settings: Settings;
}

export type AutomationStatus =
  | "injected"
  | "submitted"
  | "partial"
  | "failed";

export interface AutomationRequest {
  type: "AUTOMATION_REQUEST";
  prompt: string;
  autoSubmit: boolean;
}

export interface AutomationResponse {
  type: "AUTOMATION_RESPONSE";
  status: AutomationStatus;
}

export interface OpenProviderMessage {
  type: "OPEN_PROVIDER";
  providerId: ProviderId;
  prompt: string;
  autoSubmit: boolean;
}

export interface ProviderResultMessage {
  type: "PROVIDER_RESULT";
  providerId: ProviderId;
  status: AutomationStatus | "no-permission" | "opened";
}
