const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/gi;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkifyEscapedText(text: string) {
  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const index = match.index ?? 0;

    result += escapeHtml(text.slice(lastIndex, index));
    result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    lastIndex = index + url.length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

export function plainTextToHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return "<p></p>";
  }

  const paragraphs = normalized.split(/\n{2,}/);

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const content = lines
        .map((line) => linkifyEscapedText(line))
        .join("<br />");

      return `<p style="margin:0 0 1em 0;line-height:1.5;">${content}</p>`;
    })
    .join("");
}

export function buildReplySubject(subject: string) {
  const trimmed = subject.trim();

  if (!trimmed) {
    return "Re:";
  }

  if (/^re:/i.test(trimmed)) {
    return trimmed;
  }

  return `Re: ${trimmed}`;
}

export function buildReplyBody(original: {
  from_address: string;
  created_at: string;
  body_text: string | null;
}) {
  const quoteDate = new Date(original.created_at).toLocaleString("sr-RS");
  const quotedText = (original.body_text || "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `\n\n\nOn ${quoteDate}, ${original.from_address} wrote:\n${quotedText}`;
}
