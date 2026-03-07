import { AutomationRequest, AutomationResponse, AutomationStatus } from "../shared/types";

function findInput(): HTMLElement | null {
  return document.querySelector(
    '#prompt-textarea, div[contenteditable="true"][id="prompt-textarea"]'
  );
}

function findSubmitButton(): HTMLElement | null {
  return document.querySelector(
    'button[data-testid="send-button"], button[aria-label="Send prompt"]'
  );
}

function injectText(el: HTMLElement, text: string) {
  el.focus();
  // ChatGPT uses a contenteditable div or ProseMirror
  if (el.getAttribute("contenteditable")) {
    el.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);
  } else {
    (el as HTMLTextAreaElement).value = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

chrome.runtime.onMessage.addListener(
  (message: AutomationRequest, _sender, sendResponse) => {
    if (message.type !== "AUTOMATION_REQUEST") return false;

    const input = findInput();
    if (!input) {
      sendResponse({ type: "AUTOMATION_RESPONSE", status: "failed" } as AutomationResponse);
      return true;
    }

    injectText(input, message.prompt);

    let status: AutomationStatus = "injected";

    if (message.autoSubmit) {
      // Wait for the button to become enabled
      setTimeout(() => {
        const btn = findSubmitButton();
        if (btn && !btn.hasAttribute("disabled")) {
          btn.click();
          status = "submitted";
        } else {
          status = "partial";
        }
        sendResponse({ type: "AUTOMATION_RESPONSE", status } as AutomationResponse);
      }, 500);
    } else {
      sendResponse({ type: "AUTOMATION_RESPONSE", status } as AutomationResponse);
    }

    return true;
  }
);
