import { AutomationRequest, AutomationResponse, AutomationStatus } from "../shared/types";

function findInput(): HTMLElement | null {
  return document.querySelector(
    'div[contenteditable="true"].ProseMirror, div[contenteditable="true"][aria-label*="message"], div.ProseMirror[contenteditable="true"]'
  );
}

function findSubmitButton(): HTMLElement | null {
  return document.querySelector(
    'button[aria-label="Send Message"], button[aria-label="Send message"]'
  );
}

function injectText(el: HTMLElement, text: string) {
  el.focus();
  el.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = text;
  el.appendChild(p);
  el.dispatchEvent(new Event("input", { bubbles: true }));
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
