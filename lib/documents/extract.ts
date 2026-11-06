import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { DocumentKind, ExtractedPassage, ExtractionResult } from "./types";

const MAX_PAGES = 200;
const MAX_EXTRACTED_CHARS = 1_000_000;
const MAX_PASSAGES = 1200;
const MAX_ZIP_UNCOMPRESSED = 80 * 1024 * 1024;

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function splitPassage(text: string, locatorType: ExtractedPassage["locatorType"], locatorLabel: string) {
  const value = clean(text);
  if (!value) return [];
  const chunks: ExtractedPassage[] = [];
  for (let start = 0; start < value.length; start += 4500) chunks.push({ locatorType, locatorLabel, content: value.slice(start, start + 4500) });
  return chunks;
}
function guard(passages: ExtractedPassage[], pageCount: number | null, warning: string | null): ExtractionResult {
  const limited = passages.slice(0, MAX_PASSAGES);
  const chars = limited.reduce((sum, passage) => sum + passage.content.length, 0);
  if (chars > MAX_EXTRACTED_CHARS) throw new Error("Le texte extrait dépasse la limite autorisée.");
  return { passages: limited, pageCount, extractedChars: chars, warning: passages.length > limited.length ? "Le nombre maximal de passages a été atteint; la suite du document n’a pas été conservée." : warning };
}

async function loadBoundedZip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    expanded += (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (expanded > MAX_ZIP_UNCOMPRESSED) throw new Error("Le contenu décompressé du document dépasse la limite autorisée.");
  }
  return zip;
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, disableFontFace: true }).promise;
  if (document.numPages > MAX_PAGES) throw new Error(`Ce PDF dépasse la limite de ${MAX_PAGES} pages.`);
  const passages: ExtractedPassage[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    passages.push(...splitPassage(text.items.map(item => "str" in item ? item.str : "").join(" "), "page", `Page ${pageNumber}`));
  }
  if (!passages.length) throw new Error("Ce PDF ne contient pas de texte exploitable. Un OCR est nécessaire pour un PDF scanné.");
  return guard(passages, document.numPages, null);
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  await loadBoundedZip(buffer);
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const paragraphs = result.value.split(/\n+/).map(clean).filter(Boolean);
  const passages = paragraphs.flatMap((paragraph, index) => splitPassage(paragraph, "section", `Paragraphe ${index + 1}`));
  if (!passages.length) throw new Error("Ce DOCX ne contient pas de texte exploitable.");
  return guard(passages, null, result.messages.length ? "Le document contient des éléments non textuels qui n’ont pas été importés." : null);
}

function textNodes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textNodes);
  if (value && typeof value === "object") return Object.values(value).flatMap(textNodes);
  return [];
}

async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await loadBoundedZip(buffer);
  const parser = new XMLParser({ ignoreAttributes: true, isArray: () => false });
  const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (slideNames.length > MAX_PAGES) throw new Error(`Ce PPTX dépasse la limite de ${MAX_PAGES} diapositives.`);
  const passages: ExtractedPassage[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const parsed = parser.parse(xml);
    passages.push(...splitPassage(textNodes(parsed).join(" "), "slide", `Diapositive ${name.match(/\d+/)?.[0] ?? "?"}`));
  }
  if (!passages.length) throw new Error("Ce PPTX ne contient pas de texte exploitable.");
  return guard(passages, slideNames.length, null);
}

export async function extractDocument(kind: DocumentKind, buffer: Buffer) {
  if (kind === "pdf") return extractPdf(buffer);
  if (kind === "docx") return extractDocx(buffer);
  return extractPptx(buffer);
}
