import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../supabase/migrations/202611050001_learning_space.sql", import.meta.url), "utf8");
const documentsMigration = readFileSync(new URL("../../supabase/migrations/202611050002_documents_ai.sql", import.meta.url), "utf8");
const securityMigration = readFileSync(new URL("../../supabase/migrations/202611060001_documents_ai_security.sql", import.meta.url), "utf8");

test("la migration reste du SQL brut et transactionnel", () => {
  assert.match(migration, /^begin;\s/m);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /\\.|\/\*|\*\/|```/);
});

test("la migration protège les relations et les colonnes de planification", () => {
  assert.match(migration, /ch\.id = public\.flashcards\.chapter_id/);
  assert.match(migration, /ch\.course_id = public\.flashcards\.course_id/);
  assert.match(migration, /prevent_relation_change/);
  assert.match(migration, /revoke insert, update on public\.flashcards from authenticated/);
  assert.match(migration, /grant insert \(course_id, chapter_id, question, answer\)/);
  assert.match(migration, /grant update \(question, answer\)/);
});

test("record_review gère null, statut et retour idempotent", () => {
  assert.match(migration, /p_rating is null/);
  assert.match(migration, /v_status <> 'active'/);
  assert.match(migration, /unique \(session_id, idempotency_key\)/);
  assert.match(migration, /result_due_at/);
  assert.match(migration, /result_interval_days/);
  assert.match(migration, /return query select true, v_mode = 'free', v_new_due_at, v_new_interval/);
});

test("la migration documents protège Storage, les sources et les transitions sensibles", () => {
  assert.match(documentsMigration, /^begin;\s/m);
  assert.match(documentsMigration, /commit;\s*$/);
  assert.match(documentsMigration, /course-documents/);
  assert.match(documentsMigration, /create or replace function public\.claim_document_extraction/);
  assert.match(documentsMigration, /create or replace function public\.save_generation_cards/);
  assert.match(documentsMigration, /unique \(user_id, request_key\)/);
  assert.match(documentsMigration, /revoke insert on public\.documents from authenticated/);
  assert.match(documentsMigration, /grant insert \(course_id, original_name, storage_path, mime_type, byte_size\)/);
  assert.match(documentsMigration, /pg_advisory_xact_lock/);
  assert.match(documentsMigration, /idempotency_key_reused/);
  assert.match(documentsMigration, /proposal_selection_invalid/);
  assert.match(documentsMigration, /to service_role/);
  assert.match(documentsMigration, /measured_input_tokens = case when p_input_tokens is null then null/);
  assert.match(documentsMigration, /documents_detach_flashcard_sources/);
  assert.match(documentsMigration, /on delete set null/);
  assert.doesNotMatch(documentsMigration, /OPENAI_API_KEY|NEXT_PUBLIC_OPENAI/);
});
test("la correction de permissions rÃ©serve la finalisation au serveur", () => {
  assert.match(securityMigration, /^begin;\s/m);
  assert.match(securityMigration, /drop function if exists public\.fail_document_extraction\(uuid, text\)/);
  assert.match(securityMigration, /revoke all on function public\.complete_ai_generation\(uuid, uuid, jsonb, integer, integer\) from public, anon, authenticated/);
  assert.match(securityMigration, /grant execute on function public\.complete_ai_generation\(uuid, uuid, jsonb, integer, integer\) to service_role/);
  assert.match(securityMigration, /commit;\s*$/);
});
