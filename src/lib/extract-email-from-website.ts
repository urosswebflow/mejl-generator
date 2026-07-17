const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IGNORED_EMAIL_SUFFIXES = [
  "@example.com",
  "@sentry.io",
  "@wixpress.com",
  "@wix.com",
  "@facebook.com",
  "@instagram.com",
  "@twitter.com",
  "@youtube.com",
  "@google.com",
  "@googleusercontent.com",
  "@png",
  "@jpg",
  "@jpeg",
  "@gif",
  "@webp",
  "@svg",
];

const PREFERRED_LOCAL_PARTS = [
  "info",
  "kontakt",
  "contact",
  "office",
  "mail",
  "prodaja",
  "support",
  "admin",
];

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 500_000;

function normalizeWebsiteUrl(websiteUrl: string) {
  const trimmed = websiteUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&#64;", "@")
    .replaceAll("&#x40;", "@")
    .replaceAll("&commat;", "@");
}

function isValidBusinessEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!normalized.includes("@")) {
    return false;
  }

  if (normalized.length > 254) {
    return false;
  }

  if (IGNORED_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return false;
  }

  if (
    normalized.includes("noreply") ||
    normalized.includes("no-reply") ||
    normalized.includes("donotreply")
  ) {
    return false;
  }

  return true;
}

function uniqueEmails(emails: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const email of emails) {
    const normalized = email.trim().toLowerCase();

    if (!isValidBusinessEmail(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function extractEmailsFromHtml(html: string) {
  const decoded = decodeHtmlEntities(html);
  const found: string[] = [];

  const mailtoMatches = decoded.matchAll(/mailto:([^"'>\s?]+)/gi);

  for (const match of mailtoMatches) {
    const raw = match[1]?.split("?")[0]?.trim();

    if (raw) {
      found.push(raw);
    }
  }

  const regexMatches = decoded.match(EMAIL_REGEX) || [];
  found.push(...regexMatches);

  return uniqueEmails(found);
}

function pickBestEmail(emails: string[]) {
  if (emails.length === 0) {
    return null;
  }

  for (const localPart of PREFERRED_LOCAL_PARTS) {
    const match = emails.find((email) =>
      email.startsWith(`${localPart}@`)
    );

    if (match) {
      return match;
    }
  }

  return emails[0] || null;
}

export async function extractEmailFromWebsite(
  websiteUrl: string
): Promise<string | null> {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);

  if (!normalizedUrl) {
    return null;
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MejlGenerator/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const emails = extractEmailsFromHtml(html);

    return pickBestEmail(emails);
  } catch {
    return null;
  }
}
