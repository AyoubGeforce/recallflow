begin;

-- Documents de cours et génération de flashcards sourcées.
-- Les fonctions SECURITY DEFINER ci-dessous sont limitées aux transitions
-- atomiques qui ne peuvent pas être confiées à des droits de colonne client.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  original_name text not null check (char_length(btrim(original_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  status text not null default 'uploaded' check (status in ('uploaded', 'extracting', 'ready', 'failed')),
  extraction_error text,
  warning text,
  page_count integer check (page_count is null or page_count between 0 and 500),
  extracted_chars integer check (extracted_chars is null or extracted_chars between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_passages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  locator_type text not null check (locator_type in ('page', 'slide', 'section')),
  locator_label text not null check (char_length(locator_label) between 1 and 100),
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  request_key uuid not null,
  provider text not null default 'ollama' check (provider in ('ollama', 'openai')),
  model text not null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  requested_count integer not null check (requested_count in (5, 10, 20)),
  input_passage_count integer not null check (input_passage_count between 1 and 24),
  input_passage_ids uuid[] not null default '{}'::uuid[],
  estimated_input_chars integer not null check (estimated_input_chars between 1 and 60000),
  measured_input_tokens integer check (measured_input_tokens is null or measured_input_tokens >= 0),
  measured_output_tokens integer check (measured_output_tokens is null or measured_output_tokens >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_key)
);

create table if not exists public.generation_proposals (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 4000),
  answer text not null check (char_length(btrim(answer)) between 1 and 8000),
  evidence text not null check (char_length(btrim(evidence)) between 1 and 2000),
  is_duplicate boolean not null default false,
  duplicate_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_proposal_sources (
  proposal_id uuid not null references public.generation_proposals(id) on delete cascade,
  passage_id uuid not null references public.document_passages(id) on delete cascade,
  citation_order integer not null check (citation_order >= 0),
  primary key (proposal_id, passage_id)
);

create table if not exists public.generation_saves (
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  proposal_ids uuid[] not null default '{}'::uuid[],
  created_card_ids jsonb not null default '[]'::jsonb,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (generation_id, idempotency_key)
);

create table if not exists public.flashcard_sources (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  passage_id uuid references public.document_passages(id) on delete set null,
  citation_order integer not null check (citation_order >= 0),
  excerpt text not null check (char_length(btrim(excerpt)) between 1 and 2000),
  unique (flashcard_id, citation_order)
);

alter table public.flashcards add column if not exists source_document_id uuid references public.documents(id) on delete set null;
alter table public.flashcards add column if not exists source_passage_id uuid references public.document_passages(id) on delete set null;

create index if not exists documents_course_created_idx on public.documents(course_id, created_at desc);
create index if not exists document_passages_document_ordinal_idx on public.document_passages(document_id, ordinal);
create index if not exists ai_generations_user_created_idx on public.ai_generations(user_id, created_at desc);
create index if not exists generation_proposals_generation_idx on public.generation_proposals(generation_id, created_at);
create index if not exists flashcard_sources_document_idx on public.flashcard_sources(document_id, passage_id);

create trigger documents_touch_updated_at before update on public.documents for each row execute function public.touch_updated_at();
create trigger document_jobs_touch_updated_at before update on public.document_processing_jobs for each row execute function public.touch_updated_at();
create trigger ai_generations_touch_updated_at before update on public.ai_generations for each row execute function public.touch_updated_at();

create trigger documents_prevent_owner_change before update on public.documents for each row execute function public.prevent_owner_change();
create trigger document_jobs_prevent_owner_change before update on public.document_processing_jobs for each row execute function public.prevent_owner_change();
create trigger ai_generations_prevent_owner_change before update on public.ai_generations for each row execute function public.prevent_owner_change();
create trigger generation_proposals_prevent_owner_change before update on public.generation_proposals for each row execute function public.prevent_owner_change();
create trigger generation_saves_prevent_owner_change before update on public.generation_saves for each row execute function public.prevent_owner_change();

create or replace function public.check_document_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.user_id <> auth.uid() or not exists (select 1 from public.courses c where c.id = new.course_id and c.user_id = auth.uid()) then
    raise exception 'document_owner_required' using errcode = '42501';
  end if;
  if split_part(new.storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'document_storage_path_invalid' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.check_document_passage_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.user_id <> auth.uid() or not exists (select 1 from public.documents d where d.id = new.document_id and d.user_id = auth.uid()) then
    raise exception 'document_passage_owner_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.check_flashcard_source_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if (new.source_document_id is null) <> (new.source_passage_id is null) then
    raise exception 'flashcard_source_pair_required' using errcode = '22023';
  end if;
  if new.source_document_id is not null and not exists (
    select 1 from public.documents d
    where d.id = new.source_document_id and d.course_id = new.course_id and d.user_id = auth.uid()
  ) then
    raise exception 'flashcard_source_document_invalid' using errcode = '42501';
  end if;
  if new.source_passage_id is not null and not exists (
    select 1 from public.document_passages p
    where p.id = new.source_passage_id and p.document_id = new.source_document_id and p.user_id = auth.uid()
  ) then
    raise exception 'flashcard_source_passage_invalid' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_flashcard_source_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not (new.source_document_id is null and new.source_passage_id is null) and (new.source_document_id is distinct from old.source_document_id or new.source_passage_id is distinct from old.source_passage_id) then
    raise exception 'flashcard_source_immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.detach_document_flashcard_sources()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.flashcards
  set source_document_id = null, source_passage_id = null
  where source_document_id = old.id;
  update public.flashcard_sources
  set document_id = null, passage_id = null
  where document_id = old.id or passage_id in (select p.id from public.document_passages p where p.document_id = old.id);
  return old;
end;
$$;

create trigger documents_detach_flashcard_sources before delete on public.documents for each row execute function public.detach_document_flashcard_sources();
create trigger documents_check_scope before insert or update on public.documents for each row execute function public.check_document_scope();
create trigger document_passages_check_scope before insert or update on public.document_passages for each row execute function public.check_document_passage_scope();
create trigger flashcards_check_source_scope before insert or update on public.flashcards for each row execute function public.check_flashcard_source_scope();
create trigger flashcards_prevent_source_change before update on public.flashcards for each row execute function public.prevent_flashcard_source_change();

alter table public.documents enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.document_passages enable row level security;
alter table public.ai_generations enable row level security;
alter table public.generation_proposals enable row level security;
alter table public.generation_proposal_sources enable row level security;
alter table public.generation_saves enable row level security;
alter table public.flashcard_sources enable row level security;

create policy documents_select_own on public.documents for select to authenticated using (user_id = auth.uid());
create policy documents_insert_own on public.documents for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.courses c where c.id = public.documents.course_id and c.user_id = auth.uid()));
create policy documents_delete_own on public.documents for delete to authenticated using (user_id = auth.uid());
create policy document_jobs_select_own on public.document_processing_jobs for select to authenticated using (user_id = auth.uid());
create policy document_passages_select_own on public.document_passages for select to authenticated using (user_id = auth.uid());
create policy ai_generations_select_own on public.ai_generations for select to authenticated using (user_id = auth.uid());
create policy generation_proposals_select_own on public.generation_proposals for select to authenticated using (user_id = auth.uid());
create policy generation_proposal_sources_select_own on public.generation_proposal_sources for select to authenticated using (exists (select 1 from public.generation_proposals gp where gp.id = public.generation_proposal_sources.proposal_id and gp.user_id = auth.uid()));
create policy generation_saves_select_own on public.generation_saves for select to authenticated using (user_id = auth.uid());
create policy flashcard_sources_select_own on public.flashcard_sources for select to authenticated using (exists (select 1 from public.flashcards f where f.id = public.flashcard_sources.flashcard_id and f.user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-documents', 'course-documents', false, 20971520, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = excluded.allowed_mime_types;

create policy course_documents_storage_select on storage.objects for select to authenticated using (bucket_id = 'course-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy course_documents_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'course-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy course_documents_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'course-documents' and (storage.foldername(name))[1] = auth.uid()::text);

revoke insert on public.documents from authenticated;
grant select, delete on public.documents to authenticated;
grant select on public.document_processing_jobs, public.document_passages, public.ai_generations, public.generation_proposals, public.generation_proposal_sources, public.generation_saves, public.flashcard_sources to authenticated;
grant insert (course_id, original_name, storage_path, mime_type, byte_size) on public.documents to authenticated;
grant select on storage.objects to authenticated;
revoke all on public.documents, public.document_processing_jobs, public.document_passages, public.ai_generations, public.generation_proposals, public.generation_proposal_sources, public.generation_saves, public.flashcard_sources from anon;
revoke all on public.documents from authenticated;
grant select, delete on public.documents to authenticated;

grant insert (source_document_id, source_passage_id) on public.flashcards to authenticated;

create or replace function public.start_ai_generation(
  p_request_key uuid,
  p_course_id uuid,
  p_document_id uuid,
  p_chapter_id uuid,
  p_input_passage_ids uuid[],
  p_requested_count integer,
  p_input_passage_count integer,
  p_estimated_input_chars integer,
  p_model text
)
returns table (generation_id uuid, generation_status text, already_exists boolean)
language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_status text;
  v_daily_count integer;
  v_active_count integer;
  v_existing public.ai_generations%rowtype;
  v_model text := left(coalesce(nullif(p_model, ''), 'ollama'), 100);
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_request_key is null or p_requested_count not in (5, 10, 20) or p_input_passage_count not between 1 and 24 or p_estimated_input_chars not between 1 and 60000 or coalesce(cardinality(p_input_passage_ids), 0) <> p_input_passage_count then
    raise exception 'generation_limits_invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended((v_user_id::text || ':' || p_request_key::text), 0));
  select * into v_existing from public.ai_generations g where g.user_id = v_user_id and g.request_key = p_request_key for update;
  if found then
    if v_existing.course_id is distinct from p_course_id or v_existing.document_id is distinct from p_document_id or v_existing.chapter_id is distinct from p_chapter_id or v_existing.requested_count is distinct from p_requested_count or v_existing.input_passage_count is distinct from p_input_passage_count or v_existing.input_passage_ids is distinct from p_input_passage_ids or v_existing.estimated_input_chars is distinct from p_estimated_input_chars or v_existing.model is distinct from v_model then
      raise exception 'generation_request_key_reused' using errcode = '22023';
    end if;
    if v_existing.status = 'processing' and v_existing.updated_at < now() - interval '15 minutes' then
      update public.ai_generations set status = 'failed', error_code = 'stale_generation', error_message = 'Traitement interrompu après expiration du délai.' where id = v_existing.id;
      v_existing.status := 'failed';
    end if;
    return query select v_existing.id, v_existing.status, true;
    return;
  end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.user_id = v_user_id)
     or not exists (select 1 from public.documents d where d.id = p_document_id and d.course_id = p_course_id and d.user_id = v_user_id)
     or not exists (select 1 from public.chapters ch where ch.id = p_chapter_id and ch.course_id = p_course_id and ch.user_id = v_user_id) then
    raise exception 'generation_scope_forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(p_input_passage_ids) as selected_id where not exists (select 1 from public.document_passages p where p.id = selected_id and p.document_id = p_document_id and p.user_id = v_user_id)) then
    raise exception 'generation_passage_scope_forbidden' using errcode = '42501';
  end if;
  select count(*)::integer into v_active_count from public.ai_generations g where g.user_id = v_user_id and g.status = 'processing';
  if v_active_count >= 2 then raise exception 'generation_concurrency_limit' using errcode = '54000'; end if;
  select count(*)::integer into v_daily_count from public.ai_generations g where g.user_id = v_user_id and g.created_at >= date_trunc('day', now());
  if v_daily_count >= 20 then raise exception 'generation_daily_limit' using errcode = '54000'; end if;
  insert into public.ai_generations(user_id, course_id, document_id, chapter_id, request_key, model, requested_count, input_passage_count, input_passage_ids, estimated_input_chars)
  values (v_user_id, p_course_id, p_document_id, p_chapter_id, p_request_key, v_model, p_requested_count, p_input_passage_count, p_input_passage_ids, p_estimated_input_chars)
  on conflict (user_id, request_key) do nothing returning id, status into v_id, v_status;
  if v_id is null then
    select g.id, g.status into v_id, v_status from public.ai_generations g where g.user_id = v_user_id and g.request_key = p_request_key;
    return query select v_id, v_status, true;
    return;
  end if;
  return query select v_id, v_status, false;
end;
$$;

create or replace function public.claim_document_extraction(p_user_id uuid, p_document_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
declare v_user_id uuid := p_user_id; v_claimed boolean := false;
begin
  if v_user_id is null then raise exception 'trusted_identity_required' using errcode = '42501'; end if;
  update public.documents set status = 'extracting', extraction_error = null where id = p_document_id and user_id = v_user_id and status in ('uploaded', 'failed') and not exists (select 1 from public.document_processing_jobs j where j.document_id = p_document_id and j.attempts >= 3);
  if found then
    insert into public.document_processing_jobs(document_id, user_id, status, attempts, started_at)
    values (p_document_id, v_user_id, 'processing', 1, now())
    on conflict (document_id) do update set status = 'processing', attempts = public.document_processing_jobs.attempts + 1, started_at = now(), last_error = null
    where public.document_processing_jobs.user_id = v_user_id and public.document_processing_jobs.attempts < 3;
    v_claimed := found;
  end if;
  return v_claimed;
end;
$$;

create or replace function public.complete_document_extraction(p_user_id uuid, p_document_id uuid, p_passages jsonb, p_warning text, p_page_count integer, p_extracted_chars integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
declare v_user_id uuid := p_user_id; v_doc_user uuid; v_count integer;
begin
  select d.user_id into v_doc_user from public.documents d where d.id = p_document_id and d.user_id = v_user_id for update;
  if v_doc_user is null then raise exception 'document_not_owned' using errcode = '42501'; end if;
  delete from public.document_passages where document_id = p_document_id;
  insert into public.document_passages(document_id, user_id, ordinal, locator_type, locator_label, content)
  select p_document_id, v_user_id, row_number() over () - 1, p.locator_type, p.locator_label, p.content
  from jsonb_to_recordset(coalesce(p_passages, '[]'::jsonb)) as p(locator_type text, locator_label text, content text);
  get diagnostics v_count = row_count;
  update public.documents set status = 'ready', warning = p_warning, page_count = p_page_count, extracted_chars = p_extracted_chars, extraction_error = null where id = p_document_id;
  update public.document_processing_jobs set status = 'completed', completed_at = now(), last_error = null where document_id = p_document_id and user_id = v_user_id;
  return true;
end;
$$;

create or replace function public.fail_document_extraction(p_user_id uuid, p_document_id uuid, p_error text)
returns boolean language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
begin
  if p_user_id is null then raise exception 'trusted_identity_required' using errcode = '42501'; end if;
  update public.documents set status = 'failed', extraction_error = left(coalesce(p_error, 'Extraction impossible.'), 1000) where id = p_document_id and user_id = p_user_id;
  update public.document_processing_jobs set status = 'failed', last_error = left(coalesce(p_error, 'Extraction impossible.'), 1000), completed_at = now() where document_id = p_document_id and user_id = p_user_id;
  return found;
end;
$$;

create or replace function public.complete_ai_generation(p_user_id uuid, p_generation_id uuid, p_proposals jsonb, p_input_tokens integer, p_output_tokens integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
declare v_user_id uuid := p_user_id; v_doc_id uuid; v_count integer; v_proposal record; v_source jsonb; v_proposal_id uuid;
begin
  if v_user_id is null then raise exception 'trusted_identity_required' using errcode = '42501'; end if;
  select g.user_id, g.document_id into v_user_id, v_doc_id from public.ai_generations g where g.id = p_generation_id and g.user_id = v_user_id and g.status = 'processing' for update;
  if v_doc_id is null then raise exception 'generation_not_processable' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_proposals, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_proposals, '[]'::jsonb)) < 1 then raise exception 'generation_proposals_required' using errcode = '22023'; end if;
  if jsonb_array_length(p_proposals) > (select g.requested_count from public.ai_generations g where g.id = p_generation_id) then raise exception 'generation_proposals_limit' using errcode = '22023'; end if;
  for v_proposal in select * from jsonb_to_recordset(p_proposals) as p(question text, answer text, evidence text, passage_ids jsonb, is_duplicate boolean, duplicate_reason text) loop
    if jsonb_typeof(coalesce(v_proposal.passage_ids, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(v_proposal.passage_ids, '[]'::jsonb)) < 1 then raise exception 'generation_source_required' using errcode = '22023'; end if;
    insert into public.generation_proposals(generation_id, user_id, question, answer, evidence, is_duplicate, duplicate_reason)
    values (p_generation_id, v_user_id, v_proposal.question, v_proposal.answer, v_proposal.evidence, coalesce(v_proposal.is_duplicate, false), v_proposal.duplicate_reason)
    returning id into v_proposal_id;
    for v_source in select value from jsonb_array_elements(coalesce(v_proposal.passage_ids, '[]'::jsonb)) as source(value) loop
      if not exists (select 1 from public.document_passages p where p.id = (v_source #>> '{}')::uuid and p.document_id = v_doc_id and p.user_id = v_user_id and p.id = any((select g.input_passage_ids from public.ai_generations g where g.id = p_generation_id))) then
        raise exception 'generation_source_invalid' using errcode = '22023';
      end if;
      insert into public.generation_proposal_sources(proposal_id, passage_id, citation_order)
      values (v_proposal_id, (v_source #>> '{}')::uuid, (select count(*)::integer from public.generation_proposal_sources where proposal_id = v_proposal_id));
    end loop;
  end loop;
  update public.ai_generations set status = 'ready', measured_input_tokens = case when p_input_tokens is null then null else greatest(p_input_tokens, 0) end, measured_output_tokens = case when p_output_tokens is null then null else greatest(p_output_tokens, 0) end, error_code = null, error_message = null where id = p_generation_id;
  return true;
end;
$$;

create or replace function public.fail_ai_generation(p_user_id uuid, p_generation_id uuid, p_error_code text, p_error_message text)
returns boolean language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
begin
  if p_user_id is null then raise exception 'trusted_identity_required' using errcode = '42501'; end if;
  update public.ai_generations set status = 'failed', error_code = left(coalesce(p_error_code, 'generation_failed'), 100), error_message = left(coalesce(p_error_message, 'Génération impossible.'), 1000) where id = p_generation_id and user_id = p_user_id and status = 'processing';
  return found;
end;
$$;

create or replace function public.save_generation_cards(p_generation_id uuid, p_proposal_ids uuid[], p_idempotency_key uuid)
returns table (created_card_ids jsonb, inserted_count integer, skipped_count integer, duplicate_request boolean)
language plpgsql security definer set search_path = public, pg_temp set row_security = on as $$
declare v_user_id uuid := auth.uid(); v_existing public.generation_saves%rowtype; v_gen public.ai_generations%rowtype; v_proposal record; v_card_id uuid; v_ids jsonb := '[]'::jsonb; v_inserted integer := 0; v_skipped integer := 0; v_first_passage uuid; v_source record; v_normalized_ids uuid[];
begin
  if v_user_id is null or p_idempotency_key is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  v_normalized_ids := coalesce(array(select unnest(p_proposal_ids) order by 1), array[]::uuid[]);
  perform pg_advisory_xact_lock(hashtextextended((v_user_id::text || ':' || p_generation_id::text || ':' || p_idempotency_key::text), 0));
  select * into v_existing from public.generation_saves s where s.generation_id = p_generation_id and s.idempotency_key = p_idempotency_key and s.user_id = v_user_id;
  if found then
    if v_existing.proposal_ids <> v_normalized_ids then raise exception 'idempotency_key_reused' using errcode = '22023'; end if;
    return query select v_existing.created_card_ids, v_existing.inserted_count, v_existing.skipped_count, true; return;
  end if;
  select * into v_gen from public.ai_generations g where g.id = p_generation_id and g.user_id = v_user_id and g.status = 'ready' for update;
  if v_gen.id is null then raise exception 'generation_not_ready' using errcode = '40901'; end if;
  if coalesce(array_length(p_proposal_ids, 1), 0) < 1 or coalesce(array_length(p_proposal_ids, 1), 0) <> (select count(*) from public.generation_proposals gp where gp.generation_id = p_generation_id and gp.id = any(p_proposal_ids)) then raise exception 'proposal_selection_invalid' using errcode = '22023'; end if;
  if coalesce(array_length(p_proposal_ids, 1), 0) > v_gen.requested_count then raise exception 'too_many_proposals' using errcode = '22023'; end if;
  for v_proposal in select gp.* from public.generation_proposals gp where gp.generation_id = p_generation_id and gp.id = any(coalesce(p_proposal_ids, array[]::uuid[])) order by gp.created_at for update loop
    select p.passage_id into v_first_passage from public.generation_proposal_sources p where p.proposal_id = v_proposal.id order by p.citation_order limit 1;
    select f.id into v_card_id from public.flashcards f where f.user_id = v_user_id and f.chapter_id = v_gen.chapter_id and lower(btrim(f.question)) = lower(btrim(v_proposal.question)) and lower(btrim(f.answer)) = lower(btrim(v_proposal.answer)) limit 1;
    if v_card_id is null then
      insert into public.flashcards(course_id, chapter_id, user_id, question, answer, source_document_id, source_passage_id)
      values (v_gen.course_id, v_gen.chapter_id, v_user_id, btrim(v_proposal.question), btrim(v_proposal.answer), v_gen.document_id, v_first_passage)
      returning id into v_card_id;
      insert into public.flashcard_sources(flashcard_id, document_id, passage_id, citation_order, excerpt)
      select v_card_id, v_gen.document_id, s.passage_id, s.citation_order, v_proposal.evidence
      from public.generation_proposal_sources s where s.proposal_id = v_proposal.id;
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
    v_ids := v_ids || to_jsonb(v_card_id);
  end loop;
  insert into public.generation_saves(generation_id, user_id, idempotency_key, proposal_ids, created_card_ids, inserted_count, skipped_count) values (p_generation_id, v_user_id, p_idempotency_key, v_normalized_ids, v_ids, v_inserted, v_skipped);
  return query select v_ids, v_inserted, v_skipped, false;
end;
$$;

revoke all on function public.check_document_scope(), public.check_document_passage_scope(), public.check_flashcard_source_scope(), public.prevent_flashcard_source_change() from public, anon;
grant execute on function public.check_document_scope(), public.check_document_passage_scope(), public.check_flashcard_source_scope(), public.prevent_flashcard_source_change() to authenticated;
revoke all on function public.detach_document_flashcard_sources() from public, anon, authenticated;
revoke all on function public.start_ai_generation(uuid, uuid, uuid, uuid, uuid[], integer, integer, integer, text), public.claim_document_extraction(uuid, uuid), public.complete_document_extraction(uuid, uuid, jsonb, text, integer, integer), public.fail_document_extraction(uuid, uuid, text), public.complete_ai_generation(uuid, uuid, jsonb, integer, integer), public.fail_ai_generation(uuid, uuid, text, text), public.save_generation_cards(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.start_ai_generation(uuid, uuid, uuid, uuid, uuid[], integer, integer, integer, text), public.save_generation_cards(uuid, uuid[], uuid) to authenticated;
grant execute on function public.claim_document_extraction(uuid, uuid), public.complete_document_extraction(uuid, uuid, jsonb, text, integer, integer), public.fail_document_extraction(uuid, uuid, text), public.complete_ai_generation(uuid, uuid, jsonb, integer, integer), public.fail_ai_generation(uuid, uuid, text, text) to service_role;

commit;
