import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectDocumentKind, MAX_DOCUMENT_BYTES, safeOriginalName } from "@/lib/documents/validation";

export const maxDuration = 30;
const bucket = "course-documents";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const result = await supabase.from("documents").select("id,original_name,mime_type,byte_size,status,extraction_error,warning,page_count,extracted_chars,created_at,updated_at").eq("course_id", courseId).order("created_at", { ascending: false });
  if (result.error) return NextResponse.json({ error: "Impossible de charger les documents." }, { status: 500 });
  return NextResponse.json({ documents: result.data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const course = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (course.error || !course.data) return NextResponse.json({ error: "Cours inaccessible." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Sélectionne un fichier." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) return NextResponse.json({ error: "Le fichier doit faire au maximum 20 Mo." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectDocumentKind(file.name, file.type, bytes);
  if (!kind) return NextResponse.json({ error: "Format refusé. Utilise un PDF textuel, un DOCX ou un PPTX. Les formats .doc et .ppt ne sont pas pris en charge." }, { status: 415 });
  const documentId = randomUUID();
  const extension = kind.kind;
  const storagePath = `${user.id}/${documentId}/${randomUUID()}.${extension}`;
  const inserted = await supabase.from("documents").insert({ course_id: courseId, original_name: safeOriginalName(file.name), storage_path: storagePath, mime_type: kind.mimeType, byte_size: file.size }).select("id,original_name,mime_type,byte_size,status,created_at").single();
  if (inserted.error || !inserted.data) return NextResponse.json({ error: "Impossible de créer le document." }, { status: 500 });
  const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType: kind.mimeType, upsert: false });
  if (upload.error) { await supabase.from("documents").delete().eq("id", documentId); return NextResponse.json({ error: "Impossible de stocker le document." }, { status: 500 }); }
  return NextResponse.json({ document: inserted.data }, { status: 201 });
}
