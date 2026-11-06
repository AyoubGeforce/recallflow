begin;

-- RecallFlow learning space. Run after the existing public.courses migration.
-- All ownership checks use auth.uid(). CRUD functions stay SECURITY INVOKER;
-- record_review is SECURITY DEFINER only because it must atomically write a
-- response and its schedule while direct response writes remain unavailable.

create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'owner_change_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  notes text not null default '' check (char_length(notes) <= 20000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 4000),
  answer text not null check (char_length(btrim(answer)) between 1 and 8000),
  due_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor between 1.30 and 3.00),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  mode text not null check (mode in ('due', 'free')),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.review_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.review_sessions(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  is_free_practice boolean not null default false,
  idempotency_key uuid not null,
  result_due_at timestamptz not null,
  result_interval_days integer not null check (result_interval_days >= 0),
  responded_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create index if not exists chapters_course_position_idx on public.chapters(course_id, position, created_at);
create unique index if not exists chapters_course_title_unique_idx on public.chapters(course_id, lower(btrim(title)));
create index if not exists flashcards_chapter_idx on public.flashcards(chapter_id, created_at);
create index if not exists flashcards_due_idx on public.flashcards(user_id, due_at);
create index if not exists review_sessions_user_status_idx on public.review_sessions(user_id, status, updated_at desc);
create index if not exists review_responses_user_date_idx on public.review_responses(user_id, responded_at desc);
create index if not exists review_responses_session_card_idx on public.review_responses(session_id, flashcard_id, responded_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger chapters_touch_updated_at before update on public.chapters for each row execute function public.touch_updated_at();
create trigger flashcards_touch_updated_at before update on public.flashcards for each row execute function public.touch_updated_at();
create trigger review_sessions_touch_updated_at before update on public.review_sessions for each row execute function public.touch_updated_at();
create trigger chapters_prevent_owner_change before update on public.chapters for each row execute function public.prevent_owner_change();
create trigger flashcards_prevent_owner_change before update on public.flashcards for each row execute function public.prevent_owner_change();
create trigger review_sessions_prevent_owner_change before update on public.review_sessions for each row execute function public.prevent_owner_change();
create trigger review_responses_prevent_owner_change before update on public.review_responses for each row execute function public.prevent_owner_change();

create or replace function public.check_chapter_course_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.courses c where c.id = new.course_id and c.user_id = auth.uid()) then
    raise exception 'course_owner_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.check_flashcard_relations()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (
    select 1 from public.chapters ch
    where ch.id = new.chapter_id and ch.course_id = new.course_id and ch.user_id = auth.uid()
  ) then raise exception 'chapter_owner_required' using errcode = '42501'; end if;
  return new;
end;
$$;

create or replace function public.check_review_response_relations()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.review_sessions s where s.id = new.session_id and s.user_id = auth.uid())
     or not exists (select 1 from public.flashcards f where f.id = new.flashcard_id and f.user_id = auth.uid()) then
    raise exception 'review_owner_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.check_review_session_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  chapter_course uuid;
begin
  if new.course_id is not null and not exists (
    select 1 from public.courses c
    where c.id = new.course_id and c.user_id = auth.uid()
  ) then
    raise exception 'course_owner_required' using errcode = '42501';
  end if;
  if new.chapter_id is not null then
    select ch.course_id into chapter_course from public.chapters ch
    where ch.id = new.chapter_id and ch.user_id = auth.uid();
    if chapter_course is null then raise exception 'chapter_owner_required' using errcode = '42501'; end if;
    if new.course_id is not null and new.course_id is distinct from chapter_course then
      raise exception 'session_scope_mismatch' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_relation_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_table_name = 'chapters' and new.course_id is distinct from old.course_id then
    raise exception 'chapter_course_immutable' using errcode = '22023';
  end if;
  if tg_table_name = 'flashcards' and (new.course_id is distinct from old.course_id or new.chapter_id is distinct from old.chapter_id) then
    raise exception 'flashcard_relation_immutable' using errcode = '22023';
  end if;
  if tg_table_name = 'review_sessions' and (new.course_id is distinct from old.course_id or new.chapter_id is distinct from old.chapter_id) then
    raise exception 'review_scope_immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger chapters_check_course_owner before insert or update on public.chapters for each row execute function public.check_chapter_course_owner();
create trigger flashcards_check_relations before insert or update on public.flashcards for each row execute function public.check_flashcard_relations();
create trigger review_responses_check_relations before insert or update on public.review_responses for each row execute function public.check_review_response_relations();
create trigger review_sessions_check_scope before insert or update on public.review_sessions for each row execute function public.check_review_session_scope();
create trigger chapters_prevent_relation_change before update on public.chapters for each row execute function public.prevent_relation_change();
create trigger flashcards_prevent_relation_change before update on public.flashcards for each row execute function public.prevent_relation_change();
create trigger review_sessions_prevent_relation_change before update on public.review_sessions for each row execute function public.prevent_relation_change();

alter table public.chapters enable row level security;
alter table public.flashcards enable row level security;
alter table public.review_sessions enable row level security;
alter table public.review_responses enable row level security;

create policy chapters_select_own on public.chapters for select to authenticated using (user_id = auth.uid());
create policy chapters_insert_own on public.chapters for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.courses c where c.id = public.chapters.course_id and c.user_id = auth.uid()));
create policy chapters_update_own on public.chapters for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.courses c where c.id = public.chapters.course_id and c.user_id = auth.uid()));
create policy chapters_delete_own on public.chapters for delete to authenticated using (user_id = auth.uid());

create policy flashcards_select_own on public.flashcards for select to authenticated using (user_id = auth.uid());
create policy flashcards_insert_own on public.flashcards for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.chapters ch where ch.id = public.flashcards.chapter_id and ch.course_id = public.flashcards.course_id and ch.user_id = auth.uid()));
create policy flashcards_update_own on public.flashcards for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.chapters ch where ch.id = public.flashcards.chapter_id and ch.course_id = public.flashcards.course_id and ch.user_id = auth.uid()));
create policy flashcards_delete_own on public.flashcards for delete to authenticated using (user_id = auth.uid());

create policy review_sessions_select_own on public.review_sessions for select to authenticated using (user_id = auth.uid());
create policy review_sessions_insert_own on public.review_sessions for insert to authenticated with check (user_id = auth.uid() and (course_id is null or exists (select 1 from public.courses c where c.id = public.review_sessions.course_id and c.user_id = auth.uid())) and (chapter_id is null or exists (select 1 from public.chapters ch where ch.id = public.review_sessions.chapter_id and (public.review_sessions.course_id is null or ch.course_id = public.review_sessions.course_id) and ch.user_id = auth.uid())));
create policy review_sessions_update_own on public.review_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (course_id is null or exists (select 1 from public.courses c where c.id = public.review_sessions.course_id and c.user_id = auth.uid())) and (chapter_id is null or exists (select 1 from public.chapters ch where ch.id = public.review_sessions.chapter_id and (public.review_sessions.course_id is null or ch.course_id = public.review_sessions.course_id) and ch.user_id = auth.uid())));
create policy review_sessions_delete_own on public.review_sessions for delete to authenticated using (user_id = auth.uid());

create policy review_responses_select_own on public.review_responses for select to authenticated using (user_id = auth.uid());
create policy review_responses_insert_own on public.review_responses for insert to authenticated with check (user_id = auth.uid());
create policy review_responses_update_own on public.review_responses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy review_responses_delete_own on public.review_responses for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.chapters, public.flashcards, public.review_sessions, public.review_responses to authenticated;
revoke all on public.chapters, public.flashcards, public.review_sessions, public.review_responses from anon;
revoke insert, update, delete on public.review_responses from authenticated;
revoke insert, update on public.flashcards from authenticated;
grant insert (course_id, chapter_id, question, answer) on public.flashcards to authenticated;
grant update (question, answer) on public.flashcards to authenticated;
revoke update on public.chapters, public.review_sessions from authenticated;
grant update (title, description, notes, position) on public.chapters to authenticated;
grant update (status, ended_at) on public.review_sessions to authenticated;

-- Responses are written only by record_review(), so the response and schedule
-- update share one database transaction. A new attempt uses a new key; a
-- retried request reuses its key and returns without changing the schedule.
create or replace function public.record_review(
  p_session_id uuid,
  p_flashcard_id uuid,
  p_rating text,
  p_idempotency_key uuid
)
returns table (duplicate boolean, practice boolean, due_at timestamptz, interval_days integer)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = on
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text;
  v_status text;
  v_existing_flashcard uuid;
  v_existing_rating text;
  v_due_at timestamptz;
  v_interval integer;
  v_ease numeric;
  v_repetitions integer;
  v_lapses integer;
  v_now timestamptz := clock_timestamp();
  v_new_interval integer;
  v_new_ease numeric;
  v_new_repetitions integer;
  v_new_lapses integer;
  v_new_due_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_rating is null or p_rating not in ('again', 'hard', 'good', 'easy') then raise exception 'invalid_rating' using errcode = '22023'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required' using errcode = '22023'; end if;

  select rs.mode, rs.status into v_mode, v_status from public.review_sessions rs
  where rs.id = p_session_id and rs.user_id = v_user_id for update;
  if v_mode is null then raise exception 'review_session_not_owned' using errcode = '42501'; end if;

  select f.due_at, f.interval_days, f.ease_factor, f.repetitions, f.lapses
  into v_due_at, v_interval, v_ease, v_repetitions, v_lapses
  from public.flashcards f where f.id = p_flashcard_id and f.user_id = v_user_id for update;
  if not found then raise exception 'flashcard_not_owned' using errcode = '42501'; end if;

  if exists (select 1 from public.review_sessions rs where rs.id = p_session_id and rs.chapter_id is not null and rs.chapter_id <> (select f.chapter_id from public.flashcards f where f.id = p_flashcard_id))
     or exists (select 1 from public.review_sessions rs where rs.id = p_session_id and rs.course_id is not null and rs.course_id <> (select f.course_id from public.flashcards f where f.id = p_flashcard_id)) then
    raise exception 'review_scope_mismatch' using errcode = '22023';
  end if;

  select rr.flashcard_id, rr.rating, rr.result_due_at, rr.result_interval_days
  into v_existing_flashcard, v_existing_rating, v_new_due_at, v_new_interval
  from public.review_responses rr
  where rr.session_id = p_session_id and rr.idempotency_key = p_idempotency_key and rr.user_id = v_user_id;
  if found then
    if v_existing_flashcard <> p_flashcard_id or v_existing_rating <> p_rating then raise exception 'idempotency_key_conflict' using errcode = '23505'; end if;
    return query select true, v_mode = 'free', v_new_due_at, v_new_interval;
    return;
  end if;

  if v_status <> 'active' then raise exception 'review_session_not_active' using errcode = '40901'; end if;

  if v_mode = 'free' then
    insert into public.review_responses(session_id, flashcard_id, user_id, rating, is_free_practice, idempotency_key, result_due_at, result_interval_days)
    values (p_session_id, p_flashcard_id, v_user_id, p_rating, true, p_idempotency_key, v_due_at, v_interval);
    return query select false, true, v_due_at, v_interval;
    return;
  end if;

  v_new_ease := least(3, greatest(1.3, v_ease + case p_rating when 'easy' then 0.15 when 'hard' then -0.15 when 'again' then -0.2 else 0 end));
  if p_rating = 'again' then
    v_new_due_at := v_now + interval '10 minutes'; v_new_interval := 0; v_new_repetitions := 0; v_new_lapses := v_lapses + 1;
  elsif v_repetitions = 0 then
    v_new_interval := case when p_rating = 'easy' then 4 else 1 end; v_new_due_at := v_now + make_interval(days => v_new_interval); v_new_repetitions := 1; v_new_lapses := v_lapses;
  else
    v_new_interval := least(3650, greatest(1, round(greatest(1, v_interval) * case when p_rating = 'easy' then v_new_ease * 1.3 when p_rating = 'hard' then 1.2 else v_new_ease end)::integer));
    v_new_due_at := v_now + make_interval(days => v_new_interval); v_new_repetitions := v_repetitions + 1; v_new_lapses := v_lapses;
  end if;
  insert into public.review_responses(session_id, flashcard_id, user_id, rating, is_free_practice, idempotency_key, result_due_at, result_interval_days)
  values (p_session_id, p_flashcard_id, v_user_id, p_rating, false, p_idempotency_key, v_new_due_at, v_new_interval);
  update public.flashcards set due_at = v_new_due_at, interval_days = v_new_interval, ease_factor = v_new_ease, repetitions = v_new_repetitions, lapses = v_new_lapses, last_reviewed_at = v_now where id = p_flashcard_id;
  return query select false, false, v_new_due_at, v_new_interval;
end;
$$;

revoke all on function public.prevent_owner_change() from public, anon;
revoke all on function public.touch_updated_at() from public, anon;
revoke all on function public.check_chapter_course_owner() from public, anon;
revoke all on function public.check_flashcard_relations() from public, anon;
revoke all on function public.check_review_response_relations() from public, anon;
revoke all on function public.check_review_session_scope() from public, anon;
revoke all on function public.prevent_relation_change() from public, anon;
grant execute on function public.prevent_owner_change(), public.touch_updated_at(), public.check_chapter_course_owner(), public.check_flashcard_relations(), public.check_review_response_relations(), public.check_review_session_scope(), public.prevent_relation_change() to authenticated;
revoke all on function public.record_review(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_review(uuid, uuid, text, uuid) to authenticated;
revoke insert, update, delete on public.review_responses from authenticated;
grant select on public.review_responses to authenticated;

commit;
