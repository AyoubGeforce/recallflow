import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(_request: Request, context: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const generation = await supabase.from("ai_generations").select("id,status,requested_count,error_message,model,measured_input_tokens,measured_output_tokens").eq("id", generationId).maybeSingle();
  if (generation.error || !generation.data) return NextResponse.json({ error: "Génération introuvable." }, { status: 404 });
  const proposals = await supabase.from("generation_proposals").select("id,question,answer,evidence,is_duplicate,duplicate_reason,generation_proposal_sources(passage_id,citation_order,document_passages(locator_label,content))").eq("generation_id", generationId).order("created_at");
  return NextResponse.json({ generation: generation.data, proposals: proposals.data ?? [] });
}
