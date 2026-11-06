import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request, context: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = await request.json().catch(() => null) as { proposalIds?: string[]; requestId?: string } | null;
  if (!body?.requestId || !uuid.test(body.requestId) || !Array.isArray(body.proposalIds) || body.proposalIds.length < 1 || body.proposalIds.some(id => typeof id !== "string" || !uuid.test(id))) return NextResponse.json({ error: "Sélection d’enregistrement invalide." }, { status: 400 });
  const result = await supabase.rpc("save_generation_cards", { p_generation_id: generationId, p_proposal_ids: body.proposalIds, p_idempotency_key: body.requestId });
  if (result.error) return NextResponse.json({ error: result.error.message.includes("duplicate") ? "Une carte identique existe déjà." : "Impossible d’enregistrer les cartes sélectionnées." }, { status: 422 });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return NextResponse.json({ createdCardIds: row?.created_card_ids ?? [], insertedCount: row?.inserted_count ?? 0, skippedCount: row?.skipped_count ?? 0, duplicateRequest: Boolean(row?.duplicate_request) });
}
