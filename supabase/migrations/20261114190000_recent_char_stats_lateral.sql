-- Review F1 (error-weighted-repeats): the window query ranked every answer of the user before keeping the last
-- `window_size`, so its cost grew with lifetime answers. Take the last answers per character with a lateral
-- top-N instead; the index now covers the whole ORDER BY so each character is a bounded index range scan.

drop index if exists public.session_answers_user_romaji_answered_idx;

create index session_answers_user_romaji_answered_idx
  on public.session_answers (user_id, romaji, answered_at desc, position desc, session_id desc);

create or replace function public.recent_char_stats(window_size int default 5)
returns table (romaji text, answers int, errors int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chars.romaji,
    count(*)::int as answers,
    (count(*) filter (where not recent.is_correct))::int as errors
  from (
    select distinct a.romaji
    from public.session_answers a
    where a.user_id = (select auth.uid())
  ) chars
  cross join lateral (
    select a.is_correct
    from public.session_answers a
    where a.user_id = (select auth.uid())
      and a.romaji = chars.romaji
    order by a.answered_at desc, a.position desc, a.session_id desc
    limit window_size
  ) recent
  group by chars.romaji;
$$;
