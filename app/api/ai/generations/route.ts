import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { generateWithOllama } from "@/lib/ai/provider";
export const maxDuration = 120;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = await request.json().catch(() => null) as { courseId?: string; documentId?: string; chapterId?: string; passageIds?: string[]; requestedCount?: number; requestId?: string } | null;
  if (!body?.courseId || !body.documentId || !body.chapterId || !body.requestId || !uuid.test(body.courseId) || !uuid.test(body.documentId) || !uuid.test(body.chapterId) || !uuid.test(body.requestId) || ![5, 10, 20].includes(body.requestedCount ?? 0) || !Array.isArray(body.passageIds) || body.passageIds.length < 1 || body.passageIds.length > 24 || body.passageIds.some(id => typeof id !== "string" || !uuid.test(id))) return NextResponse.json({ error: "Sélection de génération invalide." }, { status: 400 });
  const requestedCount = body.requestedCount as 5 | 10 | 20;
  const document = await supabase.from("documents").select("id,course_id,status").eq("id", body.documentId).eq("course_id", body.courseId).maybeSingle();
  const chapter = await supabase.from("chapters").select("id").eq("id", body.chapterId).eq("course_id", body.courseId).maybeSingle();
  if (!document.data || document.data.status !== "ready" || !chapter.data) return NextResponse.json({ error: "Le document ou le chapitre est inaccessible ou pas prêt." }, { status: 403 });
  const passages = await supabase.from("document_passages").select("id,locator_label,content").eq("document_id", body.documentId).in("id", body.passageIds);
  if (passages.error || !passages.data || passages.data.length !== body.passageIds.length) return NextResponse.json({ error: "Un passage sélectionné est introuvable." }, { status: 400 });
  const estimatedChars = passages.data.reduce((sum, passage) => sum + passage.content.length, 0);
  if (estimatedChars > 60000) return NextResponse.json({ error: "Réduis la sélection: elle dépasse la limite de texte." }, { status: 413 });
  const started = await supabase.rpc("start_ai_generation", { p_request_key: body.requestId, p_course_id: body.courseId, p_document_id: body.documentId, p_chapter_id: body.chapterId, p_input_passage_ids: body.passageIds, p_requested_count: requestedCount, p_input_passage_count: passages.data.length, p_estimated_input_chars: estimatedChars, p_model: process.env.OLLAMA_MODEL ?? "" });
  if (started.error) return NextResponse.json({ error: started.error.message.includes("limit") ? "La limite de générations est atteinte. Réessaie plus tard." : "Impossible de démarrer la génération." }, { status: 429 });
  const generation = Array.isArray(started.data) ? started.data[0] : started.data;
  if (!generation) return NextResponse.json({ error: "La génération n’a pas pu être créée." }, { status: 500 });
  if (generation.already_exists && generation.generation_status === "ready") return NextResponse.json({ generationId: generation.generation_id, status: "ready" });
  if (generation.already_exists && generation.generation_status === "processing") return NextResponse.json({ generationId: generation.generation_id, status: "processing" }, { status: 202 });
  if (generation.already_exists) return NextResponse.json({ generationId: generation.generation_id, status: "failed", error: "Cette génération a échoué. Lance une nouvelle tentative explicite." }, { status: 422 });
  try {
    const result = await generateWithOllama({ passages: passages.data.map(passage => ({ id: passage.id, locatorLabel: passage.locator_label, content: passage.content })), requestedCount, language: "fr" });
    const selected = new Map(passages.data.map(passage => [passage.id, passage.content]));
    const existing = await supabase.from("flashcards").select("question,answer").eq("chapter_id", body.chapterId);
    const seen = new Set<string>();
    const cards = result.cards.map(card => {
      if (card.passage_ids.some(id => !selected.has(id))) throw new Error("OLLAMA_INVALID_SOURCE");
      const evidence = normalize(card.evidence);
      if (!card.passage_ids.some(id => normalize(selected.get(id) ?? "").includes(evidence))) throw new Error("OLLAMA_INVALID_EVIDENCE");
      const key = `${normalize(card.question)}\n${normalize(card.answer)}`;
      const duplicate = seen.has(key) || (existing.data ?? []).some(item => normalize(item.question) === normalize(card.question) && normalize(item.answer) === normalize(card.answer));
      seen.add(key);
      return { question: card.question.trim(), answer: card.answer.trim(), evidence: card.evidence.trim(), passage_ids: card.passage_ids, is_duplicate: duplicate, duplicate_reason: duplicate ? "Carte identique ou déjà présente dans le chapitre." : null };
    });
    const trusted = createTrustedClient();
    const complete = await trusted.rpc("complete_ai_generation", { p_user_id: user.id, p_generation_id: generation.generation_id, p_proposals: cards, p_input_tokens: result.inputTokens, p_output_tokens: result.outputTokens });
    if (complete.error) throw new Error("GENERATION_SAVE_FAILED");
    return NextResponse.json({ generationId: generation.generation_id, status: "ready" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "GENERATION_FAILED";
    try {
      const trusted = createTrustedClient();
      await trusted.rpc("fail_ai_generation", { p_user_id: user.id, p_generation_id: generation.generation_id, p_error_code: code, p_error_message: code === "OLLAMA_MODEL_MISSING" ? "Ollama est disponible mais le modèle demandé n’est pas installé." : code === "OLLAMA_UNAVAILABLE" ? "Ollama est arrêté ou inaccessible sur cette machine." : "La génération n’a pas produit une réponse exploitable." });
    } catch { /* La génération reste récupérable comme traitement interrompu. */ }
    const message = code === "OLLAMA_MODEL_MISSING" ? "Le modèle Ollama demandé n’est pas installé. Aucun résultat n’a été créé." : code === "OLLAMA_UNAVAILABLE" ? "Ollama est arrêté ou inaccessible. Démarre-le puis réessaie." : "La réponse Ollama n’a pas pu être validée. Aucun résultat n’a été créé.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
