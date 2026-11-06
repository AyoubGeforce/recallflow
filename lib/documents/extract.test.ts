import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { extractDocument } from "./extract.ts";
import { detectDocumentKind } from "./validation.ts";

test("extrait les textes d’un PPTX synthétique avec la diapositive", async () => {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", "<p:sld xmlns:p=\"p\" xmlns:a=\"a\"><a:t>Principe de test</a:t><a:t> et preuve</a:t></p:sld>");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const result = await extractDocument("pptx", buffer);
  assert.equal(result.passages[0]?.locatorLabel, "Diapositive 1");
  assert.match(result.passages[0]?.content ?? "", /Principe de test et preuve/);
});

test("refuse les signatures incohérentes et les anciens formats", () => {
  assert.equal(detectDocumentKind("cours.doc", "application/msword", new Uint8Array([0x50, 0x4b, 0x03, 0x04])), null);
  assert.equal(detectDocumentKind("cours.pdf", "application/pdf", new TextEncoder().encode("NOTPDF")), null);
  assert.equal(detectDocumentKind("cours.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7"))?.kind, "pdf");
});
