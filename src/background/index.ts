import { OpenProviderMessage, ProviderResultMessage, AutomationRequest, AutomationResponse, ProviderId } from "../shared/types";
import { PROVIDERS } from "../shared/providers";

chrome.runtime.onMessage.addListener(
  (message: OpenProviderMessage | { type: string }, _sender, sendResponse) => {
    if (message.type === "OPEN_OPTIONS") {
      chrome.runtime.openOptionsPage();
      return false;
    }
    if (message.type !== "OPEN_PROVIDER") return false;
    handleOpenProvider(message as OpenProviderMessage).then(sendResponse);
    return true; // async response
  }
);

async function handleOpenProvider(
  message: OpenProviderMessage
): Promise<ProviderResultMessage> {
  const { providerId, prompt, autoSubmit } = message;
  const provider = PROVIDERS[providerId];

  // Open the provider tab
  const tab = await chrome.tabs.create({ url: provider.url });

  // Check if we have host permission for automation
  const hasPermission = await chrome.permissions
    .contains({ origins: [provider.origin] })
    .catch(() => false);

  if (!hasPermission) {
    return { type: "PROVIDER_RESULT", providerId, status: "no-permission" };
  }

  // Wait for the tab to finish loading, then inject
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ type: "PROVIDER_RESULT", providerId, status: "opened" });
    }, 15000);

    function onUpdated(tabId: number, info: { status?: string }) {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timeout);

      // Small delay for the page to fully render
      setTimeout(() => {
        injectAndAutomate(tab.id!, providerId, prompt, autoSubmit).then(
          resolve
        );
      }, 2000);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function injectAndAutomate(
  tabId: number,
  providerId: ProviderId,
  prompt: string,
  autoSubmit: boolean
): Promise<ProviderResultMessage> {
  try {
    // Inject the provider-specific content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`ai/${providerId}.js`],
    });

    // Send the automation request
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "AUTOMATION_REQUEST",
      prompt,
      autoSubmit,
    } as AutomationRequest);

    const result = response as AutomationResponse | undefined;
    return {
      type: "PROVIDER_RESULT",
      providerId,
      status: result?.status ?? "failed",
    };
  } catch {
    return { type: "PROVIDER_RESULT", providerId, status: "failed" };
  }
}
