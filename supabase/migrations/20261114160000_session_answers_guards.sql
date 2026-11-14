-- Database-level guards for session_answers (review F1): the API validates these rules, but a signed-in
-- user can also reach PostgREST directly, so the database enforces them too.

alter table public.session_answers
  add constraint session_answers_position_check check (position >= 0);

create or replace function public.enforce_session_answer_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_total smallint;
  session_completed timestamptz;
begin
  select s.total, s.completed_at
    into session_total, session_completed
    from public.practice_sessions s
    where s.id = new.session_id;

  if not found then
    raise exception 'session not found' using errcode = '23503';
  end if;
  if new.position >= session_total then
    raise exception 'position % is out of range for a session of % questions', new.position, session_total
      using errcode = '23514';
  end if;
  if session_completed is not null then
    raise exception 'session is already completed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger session_answers_enforce_rules
  before insert on public.session_answers
  for each row execute function public.enforce_session_answer_rules();

comment on column public.practice_sessions.score is
  'Set by the completion API route from the stored answers. The update policy still lets the owner write it directly, so do not build rankings on it.';
