import pdfParse from "pdf-parse";

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export function isSupportedMime(mimeType: string): boolean {
  return SUPPORTED_MIME.has(mimeType) || mimeType.startsWith("text/");
}

export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (mimeType.startsWith("text/") || mimeType === "application/octet-stream") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
