const EXCLUDED_INSTAGRAM_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "tv",
  "accounts",
  "about",
  "legal",
  "developer",
  "direct",
  "nametag",
]);

const INSTAGRAM_URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi;

function normalizeHandle(handle: string): string | null {
  const trimmed = handle.trim().replace(/^@/, "");

  if (!trimmed || EXCLUDED_INSTAGRAM_SEGMENTS.has(trimmed.toLowerCase())) {
    return null;
  }

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(trimmed)) {
    return null;
  }

  return `https://www.instagram.com/${trimmed}/`;
}

export function instagramUrlFromWebsiteUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host !== "instagram.com") {
      return null;
    }

    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    if (!segment) return null;

    return normalizeHandle(segment);
  } catch {
    return null;
  }
}

export function extractInstagramFromText(text: string): string | null {
  if (!text) return null;

  for (const match of text.matchAll(INSTAGRAM_URL_PATTERN)) {
    const handle = match[1];
    const normalized = normalizeHandle(handle);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}
