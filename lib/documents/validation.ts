import type { DocumentKind } from "./types";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function detectDocumentKind(fileName: string, mimeType: string, bytes: Uint8Array): { kind: DocumentKind; mimeType: string } | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".ppt")) return null;
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (lower.endsWith(".pdf") && header === "%PDF-") return { kind: "pdf", mimeType: "application/pdf" };
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isZip) return null;
  if (lower.endsWith(".docx") && mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return { kind: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (lower.endsWith(".pptx") && mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return { kind: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  return null;
}

export function safeOriginalName(value: string) {
  return value.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 255) || "document";
}
