import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { extractDocument } from "@/lib/documents/extract";
import type { DocumentKind } from "@/lib/documents/types";
export const maxDuration = 120;
export async function POST(_request: Request, context: { params: Promise<{ courseId: string; documentId: string }> }) {
  const { courseId, documentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const doc = await supabase.from("documents").select("id,course_id,storage_path,mime_type,status,original_name").eq("id", documentId).eq("course_id", courseId).maybeSingle();
  if (doc.error || !doc.data) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  let trusted;
  try { trusted = createTrustedClient(); } catch { return NextResponse.json({ error: "Le traitement serveur des documents n’est pas configuré." }, { status: 503 }); }
  const claimed = await trusted.rpc("claim_document_extraction", { p_user_id: user.id, p_document_id: documentId });
  if (claimed.error) return NextResponse.json({ error: "Impossible de démarrer l’extraction." }, { status: 500 });
  if (!claimed.data) return NextResponse.json({ status: doc.data.status });
  try {
    const downloaded = await supabase.storage.from("course-documents").download(doc.data.storage_path);
    if (downloaded.error) throw new Error("Le fichier privé est inaccessible.");
    const kind: DocumentKind = doc.data.mime_type === "application/pdf" ? "pdf" : doc.data.mime_type.includes("wordprocessing") ? "docx" : "pptx";
    const result = await extractDocument(kind, Buffer.from(await downloaded.data.arrayBuffer()));
    const completed = await trusted.rpc("complete_document_extraction", { p_user_id: user.id, p_document_id: documentId, p_passages: result.passages, p_warning: result.warning, p_page_count: result.pageCount, p_extracted_chars: result.extractedChars });
    if (completed.error) throw new Error("Les passages n’ont pas pu être enregistrés.");
    return NextResponse.json({ status: "ready", passageCount: result.passages.length, warning: result.warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction impossible.";
    await trusted.rpc("fail_document_extraction", { p_user_id: user.id, p_document_id: documentId, p_error: message });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
