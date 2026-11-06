import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(_request: Request, context: { params: Promise<{ courseId: string; documentId: string }> }) {
  const { courseId, documentId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const document = await supabase.from("documents").select("storage_path,original_name").eq("id", documentId).eq("course_id", courseId).maybeSingle();
  if (document.error || !document.data) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const signed = await supabase.storage.from("course-documents").createSignedUrl(document.data.storage_path, 300);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: "Impossible de préparer le téléchargement." }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl, name: document.data.original_name });
}
