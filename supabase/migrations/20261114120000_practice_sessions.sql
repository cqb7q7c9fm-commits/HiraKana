-- Practice sessions and per-question answers, owner-only access via RLS.

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alphabet text not null check (alphabet in ('hiragana', 'katakana')),
  direction text not null check (direction in ('kana-to-romaji', 'romaji-to-kana')),
  total smallint not null check (total between 1 and 50),
  -- score is set when the session is completed (server-side), never trusted from the client.
  score smallint null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table public.session_answers (
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  position smallint not null,
  user_id uuid not null,
  romaji text not null,
  direction text not null check (direction in ('kana-to-romaji', 'romaji-to-kana')),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (session_id, position)
);

create index practice_sessions_user_completed_idx
  on public.practice_sessions (user_id, completed_at desc);

create index session_answers_user_romaji_idx
  on public.session_answers (user_id, romaji);

alter table public.practice_sessions enable row level security;
alter table public.session_answers enable row level security;

-- practice_sessions: select / insert / update for the owner (no delete policy = denied)
create policy "practice_sessions_select_own"
  on public.practice_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "practice_sessions_insert_own"
  on public.practice_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "practice_sessions_update_own"
  on public.practice_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- session_answers: select / insert only (no update, no delete)
create policy "session_answers_select_own"
  on public.session_answers for select to authenticated
  using (user_id = (select auth.uid()));

create policy "session_answers_insert_own"
  on public.session_answers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.practice_sessions s
      where s.id = session_answers.session_id
        and s.user_id = (select auth.uid())
    )
  );
