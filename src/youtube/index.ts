import { extractVideoMeta } from "./transcript";
import { renderPanel, removePanel } from "./panel";

let currentVideoId: string | null = null;

function getVideoId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

function isWatchPage(): boolean {
  return window.location.pathname === "/watch";
}

async function onVideoPage() {
  const videoId = getVideoId();
  if (!videoId || videoId === currentVideoId) return;
  currentVideoId = videoId;

  // We don't need to load transcript anymore, just metadata
  try {
    const meta = extractVideoMeta();
    renderPanel({ kind: "ready", meta });
  } catch (err: any) {
    renderPanel({
      kind: "error",
      message: err?.message ?? "Failed to get video info.",
    });
  }
}

function onNavigation() {
  if (isWatchPage()) {
    onVideoPage();
  } else {
    currentVideoId = null;
    removePanel();
  }
}

// YouTube SPA navigation
function observeNavigation() {
  // yt-navigate-finish fires on YouTube SPA route changes
  document.addEventListener("yt-navigate-finish", () => onNavigation());

  // Fallback: observe URL changes via popstate
  window.addEventListener("popstate", () => onNavigation());

  // Initial check
  onNavigation();
}

observeNavigation();
