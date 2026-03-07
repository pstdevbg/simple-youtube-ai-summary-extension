import { ProviderId } from "../shared/types";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../shared/storage";
import { PROVIDER_IDS } from "../shared/providers";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

async function load() {
  const s = await loadSettings();
  $<HTMLInputElement>("responseLanguage").value = s.responseLanguage;
  $<HTMLInputElement>("includeTimestamps").checked = s.includeTimestamps;
  $<HTMLInputElement>("includeSpeakerLabels").checked = s.includeSpeakerLabels;
  $<HTMLTextAreaElement>("promptTemplate").value = s.promptTemplate;
  $<HTMLInputElement>("allowAutomation").checked = s.allowAutomation;

  for (const id of PROVIDER_IDS) {
    $<HTMLInputElement>(`autoSubmit-${id}`).checked = s.autoSubmit[id];
  }
}

async function save() {
  const autoSubmit = {} as Record<ProviderId, boolean>;
  for (const id of PROVIDER_IDS) {
    autoSubmit[id] = $<HTMLInputElement>(`autoSubmit-${id}`).checked;
  }

  await saveSettings({
    responseLanguage: $<HTMLInputElement>("responseLanguage").value.trim() || "English",
    includeTimestamps: $<HTMLInputElement>("includeTimestamps").checked,
    includeSpeakerLabels: $<HTMLInputElement>("includeSpeakerLabels").checked,
    promptTemplate: $<HTMLTextAreaElement>("promptTemplate").value,
    allowAutomation: $<HTMLInputElement>("allowAutomation").checked,
    autoSubmit,
  });

  const status = $("status");
  status.textContent = "Settings saved!";
  setTimeout(() => (status.textContent = ""), 2000);
}

async function reset() {
  await saveSettings(DEFAULT_SETTINGS);
  await load();
  const status = $("status");
  status.textContent = "Reset to defaults.";
  setTimeout(() => (status.textContent = ""), 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("reset").addEventListener("click", reset);
});
