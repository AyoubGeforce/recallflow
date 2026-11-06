import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ReviewRating } from "@/lib/reviews/scheduling";

const ratings: ReviewRating[] = ["again", "hard", "good", "easy"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = await request.json().catch(() => null) as { cardId?: string; sessionId?: string; rating?: ReviewRating; requestId?: string } | null;
  if (!body?.cardId || !body.sessionId || !body.requestId || !uuidPattern.test(body.cardId) || !uuidPattern.test(body.sessionId) || !uuidPattern.test(body.requestId) || !body.rating || !ratings.includes(body.rating)) return NextResponse.json({ error: "Réponse de révision invalide." }, { status: 400 });
  const result = await supabase.rpc("record_review", { p_session_id: body.sessionId, p_flashcard_id: body.cardId, p_rating: body.rating, p_idempotency_key: body.requestId });
  if (result.error) {
    if (result.error.message.includes("idempotency_key_conflict")) return NextResponse.json({ error: "Cette clé de requête est déjà utilisée pour une autre réponse." }, { status: 409 });
    if (result.error.message.includes("review_session_not_active")) return NextResponse.json({ error: "Cette session de révision est déjà terminée." }, { status: 409 });
    if (result.error.message.includes("not_owned") || result.error.message.includes("scope_mismatch")) return NextResponse.json({ error: "Cette carte ne peut pas être révisée dans cette session." }, { status: 403 });
    return NextResponse.json({ error: "Impossible d’enregistrer cette réponse atomiquement." }, { status: 500 });
  }
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return NextResponse.json({ duplicate: Boolean(row?.duplicate), practice: Boolean(row?.practice), dueAt: row?.due_at ?? null, intervalDays: row?.interval_days ?? null });
}
