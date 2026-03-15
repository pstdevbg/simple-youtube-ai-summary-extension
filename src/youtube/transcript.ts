import { VideoMeta } from "../shared/types";

export function extractVideoMeta(): VideoMeta {
  const title =
    document
      .querySelector(
        'meta[property="og:title"], meta[name="title"]'
      )
      ?.getAttribute("content") ??
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
      ?.textContent ??
    document.title;

  const channel =
    document
      .querySelector(
        "#owner #channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a"
      )
      ?.textContent?.trim() ??
    document
      .querySelector('span[itemprop="author"] link[itemprop="name"]')
      ?.getAttribute("content") ??
    "Unknown";

  const durationMeta = document
    .querySelector('meta[itemprop="duration"]')
    ?.getAttribute("content");
  let duration = "Unknown";
  if (durationMeta) {
    // Parse ISO 8601 duration like PT1H2M3S
    const m = durationMeta.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) {
      const parts: string[] = [];
      if (m[1]) parts.push(`${m[1]}h`);
      if (m[2]) parts.push(`${m[2]}m`);
      if (m[3]) parts.push(`${m[3]}s`);
      duration = parts.join(" ") || "0s";
    }
  }

  const url = window.location.href.split("&")[0]; // Clean URL

  return { title, channel, duration, url };
}
