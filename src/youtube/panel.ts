import { TranscriptSegment, VideoMeta, Settings, ProviderId, ProviderResultMessage } from "../shared/types";
import { PROVIDERS, PROVIDER_IDS } from "../shared/providers";
import { formatTranscript, buildPrompt } from "../shared/prompt";
import { chunkTranscript, needsChunking, ChunkInfo } from "../shared/chunking";
import { loadSettings } from "../shared/storage";

const PANEL_ID = "yt-ai-summary-panel";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function flashButton(btn: HTMLButtonElement, text: string) {
  const orig = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1500);
}

export function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

export function renderPanel(
  state:
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | {
        kind: "ready";
        meta: VideoMeta;
        segments: TranscriptSegment[];
      }
) {
  removePanel();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;

  const header = document.createElement("div");
  header.className = "yas-header";
  header.textContent = "AI Summary";
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "yas-body";

  if (state.kind === "loading") {
    body.innerHTML = '<div class="yas-loading">Loading transcript...</div>';
  } else if (state.kind === "error") {
    const err = document.createElement("div");
    err.className = "yas-error";
    err.textContent = state.message;
    body.appendChild(err);
  } else {
    renderReadyState(body, state.meta, state.segments);
  }

  panel.appendChild(body);
  insertPanel(panel);
}

function insertPanel(panel: HTMLElement) {
  const secondary = document.querySelector("#secondary, #secondary-inner");
  if (secondary) {
    secondary.insertBefore(panel, secondary.firstChild);
  }
}

async function renderReadyState(
  body: HTMLElement,
  meta: VideoMeta,
  segments: TranscriptSegment[]
) {
  const settings = await loadSettings();
  const transcript = formatTranscript(segments, settings);
  const prompt = buildPrompt(meta, segments, settings);

  const info = document.createElement("div");
  info.className = "yas-info";
  info.textContent = `${segments.length} segments found`;
  body.appendChild(info);

  // Copy buttons row
  const copyRow = document.createElement("div");
  copyRow.className = "yas-btn-row";

  const copyTranscriptBtn = createButton("Copy Transcript", async (btn) => {
    const ok = await copyToClipboard(transcript);
    flashButton(btn, ok ? "Copied!" : "Failed");
  });

  const copyPromptBtn = createButton("Copy Prompt", async (btn) => {
    const ok = await copyToClipboard(prompt);
    flashButton(btn, ok ? "Copied!" : "Failed");
  });

  copyRow.appendChild(copyTranscriptBtn);
  copyRow.appendChild(copyPromptBtn);
  body.appendChild(copyRow);

  // Check chunking
  const chunked = PROVIDER_IDS.some((id) =>
    needsChunking(meta, segments, settings, PROVIDERS[id])
  );

  if (chunked) {
    const warn = document.createElement("div");
    warn.className = "yas-warning";
    warn.textContent =
      "Transcript may be too long for some providers. Chunks will be created automatically.";
    body.appendChild(warn);
  }

  // Provider buttons
  const provRow = document.createElement("div");
  provRow.className = "yas-btn-row yas-provider-row";

  for (const id of PROVIDER_IDS) {
    const provider = PROVIDERS[id];
    const chunks = needsChunking(meta, segments, settings, provider)
      ? chunkTranscript(meta, segments, settings, provider)
      : null;

    if (chunks && chunks.length > 1) {
      renderChunkedProvider(provRow, provider, chunks, settings, body);
    } else {
      const btn = createButton(provider.label, async (btn) => {
        const ok = await copyToClipboard(prompt);
        if (!ok) {
          flashButton(btn, "Copy failed");
          return;
        }
        flashButton(btn, "Copied! Opening...");
        sendToProvider(id, prompt, settings);
      });
      btn.classList.add("yas-provider-btn", `yas-provider-${id}`);
      provRow.appendChild(btn);
    }
  }

  body.appendChild(provRow);

  // Status area
  const status = document.createElement("div");
  status.className = "yas-status";
  status.id = "yas-status";
  body.appendChild(status);
}

function renderChunkedProvider(
  container: HTMLElement,
  provider: typeof PROVIDERS[ProviderId],
  chunks: ChunkInfo[],
  settings: Settings,
  body: HTMLElement
) {
  const wrapper = document.createElement("div");
  wrapper.className = "yas-chunk-group";

  const label = document.createElement("span");
  label.className = "yas-chunk-label";
  label.textContent = `${provider.label} (${chunks.length} chunks)`;
  wrapper.appendChild(label);

  for (const chunk of chunks) {
    const btn = createButton(
      `${provider.label} ${chunk.chunkIndex + 1}/${chunk.totalChunks}`,
      async (btn) => {
        const ok = await copyToClipboard(chunk.prompt);
        if (!ok) {
          flashButton(btn, "Copy failed");
          return;
        }
        flashButton(btn, "Copied! Opening...");
        sendToProvider(provider.id, chunk.prompt, settings);
      }
    );
    btn.classList.add("yas-provider-btn", `yas-provider-${provider.id}`);
    wrapper.appendChild(btn);
  }

  container.appendChild(wrapper);
}

function sendToProvider(
  providerId: ProviderId,
  prompt: string,
  settings: Settings
) {
  chrome.runtime.sendMessage(
    {
      type: "OPEN_PROVIDER",
      providerId,
      prompt,
      autoSubmit: settings.autoSubmit[providerId],
    },
    (response?: ProviderResultMessage) => {
      const statusEl = document.getElementById("yas-status");
      if (!statusEl) return;
      if (!response) return;

      const messages: Record<string, string> = {
        submitted: `${PROVIDERS[providerId].label}: Prompt sent and submitted!`,
        injected: `${PROVIDERS[providerId].label}: Prompt pasted. Submit manually.`,
        partial: `${PROVIDERS[providerId].label}: Prompt pasted but submit button not found. Submit manually.`,
        failed: `${PROVIDERS[providerId].label}: Auto-fill failed. Paste from clipboard.`,
        "no-permission": `${PROVIDERS[providerId].label}: Prompt copied. Paste into the opened tab.`,
        opened: `${PROVIDERS[providerId].label}: Tab opened. Paste from clipboard.`,
      };
      statusEl.textContent = messages[response.status] ?? "";
    }
  );
}

function createButton(
  text: string,
  onClick: (btn: HTMLButtonElement) => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "yas-btn";
  btn.textContent = text;
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}
