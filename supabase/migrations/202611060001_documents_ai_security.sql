begin;

-- Correction post-déploiement : supprime les anciennes surcharges éventuelles
-- et borne explicitement les RPC de finalisation au rôle serveur.
drop function if exists public.claim_document_extraction(uuid);
drop function if exists public.complete_document_extraction(uuid, jsonb, text, integer, integer);
drop function if exists public.fail_document_extraction(uuid, text);
drop function if exists public.complete_ai_generation(uuid, jsonb, integer, integer);
drop function if exists public.fail_ai_generation(uuid, text, text);
drop function if exists public.start_ai_generation(uuid, uuid, uuid, uuid, integer, integer, integer, text);

revoke all on function public.start_ai_generation(uuid, uuid, uuid, uuid, uuid[], integer, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.save_generation_cards(uuid, uuid[], uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_document_extraction(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_document_extraction(uuid, uuid, jsonb, text, integer, integer) from public, anon, authenticated;
revoke all on function public.fail_document_extraction(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_ai_generation(uuid, uuid, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.fail_ai_generation(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.start_ai_generation(uuid, uuid, uuid, uuid, uuid[], integer, integer, integer, text) to authenticated;
grant execute on function public.save_generation_cards(uuid, uuid[], uuid) to authenticated;
grant execute on function public.claim_document_extraction(uuid, uuid) to service_role;
grant execute on function public.complete_document_extraction(uuid, uuid, jsonb, text, integer, integer) to service_role;
grant execute on function public.fail_document_extraction(uuid, uuid, text) to service_role;
grant execute on function public.complete_ai_generation(uuid, uuid, jsonb, integer, integer) to service_role;
grant execute on function public.fail_ai_generation(uuid, uuid, text, text) to service_role;

commit;
