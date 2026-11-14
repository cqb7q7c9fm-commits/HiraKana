-- Per-character statistics of the last answers (S-03/S-06): the first reader of the answers-by-character access path,
-- so the index dropped in 20261114170000 comes back together with it.

create index session_answers_user_romaji_answered_idx
  on public.session_answers (user_id, romaji, answered_at desc);

-- security invoker: RLS on session_answers applies; the explicit user_id filter is a second guard and matches the index.
-- answered_at defaults to now() (transaction start), so ties are possible; position and session_id break them deterministically.
create or replace function public.recent_char_stats(window_size int default 5)
returns table (romaji text, answers int, errors int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ranked.romaji,
    count(*)::int as answers,
    (count(*) filter (where not ranked.is_correct))::int as errors
  from (
    select
      a.romaji,
      a.is_correct,
      row_number() over (
        partition by a.romaji
        order by a.answered_at desc, a.position desc, a.session_id desc
      ) as rn
    from public.session_answers a
    where a.user_id = (select auth.uid())
  ) ranked
  where ranked.rn <= window_size
  group by ranked.romaji;
$$;

revoke execute on function public.recent_char_stats(int) from public, anon;
grant execute on function public.recent_char_stats(int) to authenticated;
