import { VideoMeta, Settings, ProviderId, ProviderResultMessage } from "../shared/types";
import { PROVIDERS, PROVIDER_IDS } from "../shared/providers";
import { buildPrompt } from "../shared/prompt";
import { loadSettings } from "../shared/storage";

const PANEL_ID = "yt-ai-summary-panel";
let pendingObserver: MutationObserver | null = null;

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
  if (pendingObserver) {
    pendingObserver.disconnect();
    pendingObserver = null;
  }
  document.getElementById(PANEL_ID)?.remove();
}

export function renderPanel(
  state:
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | {
      kind: "ready";
      meta: VideoMeta;
    }
) {
  removePanel();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;

  const header = document.createElement("div");
  header.className = "yas-header";

  const headerTitle = document.createElement("span");
  headerTitle.textContent = "AI Summary";
  header.appendChild(headerTitle);

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "yas-settings-btn";
  settingsBtn.title = "Settings";
  settingsBtn.innerHTML = "&#9881;";
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  });
  header.appendChild(settingsBtn);

  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "yas-body";

  if (state.kind === "loading") {
    body.innerHTML = '<div class="yas-loading">Loading video info...</div>';
  } else if (state.kind === "error") {
    const err = document.createElement("div");
    err.className = "yas-error";
    err.textContent = state.message;
    body.appendChild(err);
  } else {
    renderReadyState(body, state.meta);
  }

  panel.appendChild(body);
  insertPanel(panel);
}

function insertPanel(panel: HTMLElement) {
  const target =
    document.querySelector("#secondary-inner") ??
    document.querySelector("#secondary");
  if (target) {
    target.insertBefore(panel, target.firstChild);
    return;
  }

  if (pendingObserver) pendingObserver.disconnect();
  const observer = new MutationObserver((_mutations, obs) => {
    const el =
      document.querySelector("#secondary-inner") ??
      document.querySelector("#secondary");
    if (el) {
      obs.disconnect();
      pendingObserver = null;
      if (panel.id !== PANEL_ID || document.getElementById(PANEL_ID)) return;
      el.insertBefore(panel, el.firstChild);
    }
  });
  pendingObserver = observer;
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    observer.disconnect();
    if (pendingObserver === observer) pendingObserver = null;
  }, 10000);
}

async function renderReadyState(
  body: HTMLElement,
  meta: VideoMeta
) {
  const settings = await loadSettings();
  const prompt = buildPrompt(meta, settings);

  // Copy buttons row
  const copyRow = document.createElement("div");
  copyRow.className = "yas-btn-row";

  const copyPromptBtn = createButton("Copy Prompt", async (btn) => {
    const ok = await copyToClipboard(prompt);
    flashButton(btn, ok ? "Copied!" : "Failed");
  });

  copyRow.appendChild(copyPromptBtn);
  body.appendChild(copyRow);

  // Provider buttons
  const provRow = document.createElement("div");
  provRow.className = "yas-btn-row yas-provider-row";

  for (const id of PROVIDER_IDS) {
    const provider = PROVIDERS[id];
    const btn = createButton(`Summarize with ${provider.label}`, async (btn) => {
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

  body.appendChild(provRow);

  // Status area
  const status = document.createElement("div");
  status.className = "yas-status";
  status.id = "yas-status";
  body.appendChild(status);
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
