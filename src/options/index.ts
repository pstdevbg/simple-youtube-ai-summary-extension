import { ProviderId } from "../shared/types";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../shared/storage";
import { PROVIDER_IDS } from "../shared/providers";
import { LANGUAGES } from "../shared/languages";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function initLanguageDropdown(initialValue: string) {
  const selected = $("langSelected");
  const panel = $("langPanel");
  const search = $<HTMLInputElement>("langSearch");
  const list = $("langList");
  const hidden = $<HTMLInputElement>("responseLanguage");

  let highlightedIndex = -1;

  function setValue(lang: string) {
    selected.textContent = lang;
    hidden.value = lang;
    panel.classList.remove("open");
    search.value = "";
    renderList("");
  }

  function renderList(filter: string) {
    list.innerHTML = "";
    const lower = filter.toLowerCase();
    const matches = LANGUAGES.filter((l) =>
      l.toLowerCase().includes(lower)
    );
    highlightedIndex = -1;

    if (matches.length === 0) {
      const noRes = document.createElement("div");
      noRes.className = "lang-no-results";
      noRes.textContent = "No languages found";
      list.appendChild(noRes);
      return;
    }

    matches.forEach((lang, i) => {
      const opt = document.createElement("div");
      opt.className = "lang-option";
      if (lang === hidden.value) opt.classList.add("selected");
      opt.textContent = lang;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setValue(lang);
      });
      opt.addEventListener("mouseenter", () => {
        clearHighlight();
        highlightedIndex = i;
        opt.classList.add("highlighted");
      });
      list.appendChild(opt);
    });
  }

  function clearHighlight() {
    list.querySelectorAll(".highlighted").forEach((el) =>
      el.classList.remove("highlighted")
    );
  }

  function getVisibleOptions() {
    return list.querySelectorAll<HTMLElement>(".lang-option");
  }

  selected.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");
    if (isOpen) {
      search.value = "";
      renderList("");
      search.focus();
    }
  });

  search.addEventListener("input", () => {
    renderList(search.value);
  });

  search.addEventListener("keydown", (e) => {
    const options = getVisibleOptions();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      clearHighlight();
      highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
      options[highlightedIndex]?.classList.add("highlighted");
      options[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      clearHighlight();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      options[highlightedIndex]?.classList.add("highlighted");
      options[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && options[highlightedIndex]) {
        setValue(options[highlightedIndex].textContent!);
      }
    } else if (e.key === "Escape") {
      panel.classList.remove("open");
    }
  });

  document.addEventListener("click", (e) => {
    if (!$("langDropdown").contains(e.target as Node)) {
      panel.classList.remove("open");
    }
  });

  setValue(initialValue);
}

async function load() {
  const s = await loadSettings();
  initLanguageDropdown(s.responseLanguage);
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
  // Re-init the dropdown with default value
  $("langSelected").textContent = DEFAULT_SETTINGS.responseLanguage;
  $<HTMLInputElement>("responseLanguage").value = DEFAULT_SETTINGS.responseLanguage;
  $<HTMLTextAreaElement>("promptTemplate").value = DEFAULT_SETTINGS.promptTemplate;
  $<HTMLInputElement>("allowAutomation").checked = DEFAULT_SETTINGS.allowAutomation;
  for (const id of PROVIDER_IDS) {
    $<HTMLInputElement>(`autoSubmit-${id}`).checked = DEFAULT_SETTINGS.autoSubmit[id];
  }
  const status = $("status");
  status.textContent = "Reset to defaults.";
  setTimeout(() => (status.textContent = ""), 2000);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("reset").addEventListener("click", reset);
});
