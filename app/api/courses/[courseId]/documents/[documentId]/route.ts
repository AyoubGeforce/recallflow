import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const bucket = "course-documents";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string; documentId: string }> }) {
  const { courseId, documentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const document = await supabase.from("documents").select("id,course_id,original_name,mime_type,byte_size,status,extraction_error,warning,page_count,extracted_chars,created_at,updated_at").eq("id", documentId).eq("course_id", courseId).maybeSingle();
  if (document.error || !document.data) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const passages = await supabase.from("document_passages").select("id,ordinal,locator_type,locator_label,content").eq("document_id", documentId).order("ordinal");
  if (passages.error) return NextResponse.json({ error: "Impossible de charger les passages." }, { status: 500 });
  return NextResponse.json({ document: document.data, passages: passages.data ?? [] });
}

export async function DELETE(_request: Request, context: { params: Promise<{ courseId: string; documentId: string }> }) {
  const { courseId, documentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const document = await supabase.from("documents").select("id,storage_path").eq("id", documentId).eq("course_id", courseId).maybeSingle();
  if (document.error || !document.data) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const removed = await supabase.storage.from(bucket).remove([document.data.storage_path]);
  if (removed.error) return NextResponse.json({ error: "Le fichier n’a pas pu être nettoyé; le document est conservé." }, { status: 500 });
  const deleted = await supabase.from("documents").delete().eq("id", documentId).eq("course_id", courseId);
  if (deleted.error) return NextResponse.json({ error: "Le fichier a été retiré mais les métadonnées n’ont pas pu être supprimées." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
