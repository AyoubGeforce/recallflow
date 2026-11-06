begin;

-- Schéma initial requis par les migrations learning_space et documents_ai.
-- À exécuter avant 202611050001_learning_space.sql.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists courses_user_name_unique_idx
  on public.courses(user_id, lower(btrim(name)));

create or replace function public.touch_course_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_touch_updated_at on public.courses;
create trigger courses_touch_updated_at
before update on public.courses
for each row execute function public.touch_course_updated_at();

alter table public.courses enable row level security;

drop policy if exists courses_select_own on public.courses;
create policy courses_select_own on public.courses
for select to authenticated
using (user_id = auth.uid());

drop policy if exists courses_insert_own on public.courses;
create policy courses_insert_own on public.courses
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists courses_update_own on public.courses;
create policy courses_update_own on public.courses
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists courses_delete_own on public.courses;
create policy courses_delete_own on public.courses
for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.courses to authenticated;
revoke all on public.courses from anon;

revoke all on function public.touch_course_updated_at() from public, anon;
grant execute on function public.touch_course_updated_at() to authenticated;

commit;
