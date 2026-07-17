import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12000;

export { PROPOSAL_UPLOAD_ACCEPT } from "@/lib/proposal-upload-constants";

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function truncateText(text: string) {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_EXTRACTED_CHARS).trim()}\n\n[...]`;
}

export async function extractProposalFileText(
  buffer: Buffer,
  mimeType: string,
  filename: string
) {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Fajl je prevelik. Maksimalna veličina je 5 MB.");
  }

  const lowerName = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");

  if (!isPdf && !isDocx) {
    throw new Error("Podržani formati su PDF i DOCX.");
  }

  let extracted = "";

  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    extracted = parsed.text || "";
  } else {
    const parsed = await mammoth.extractRawText({ buffer });
    extracted = parsed.value || "";
  }

  const normalized = normalizeExtractedText(extracted);

  if (!normalized) {
    throw new Error("Iz fajla nije moguće izvući tekst.");
  }

  return truncateText(normalized);
}
