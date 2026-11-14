# Group mastery view — Plan Brief

> Full plan: `context/changes/group-mastery-view/plan.md`

## What & Why

Strona `/mastery` pokazuje, które z 13 grup znaków użytkownik ma opanowane, oraz siłę znajomości grupy i każdego znaku w 3-stopniowej skali kolorów z drugim sygnałem poza kolorem (FR-010, FR-011). Zamyka wycinek S-05, który czekał na definicję progów.

## Starting Point

Statystyka znaku z ostatnich 5 odpowiedzi (`recent_char_stats`), grupy w `KANA_GROUPS` oraz wzorzec strony `/hot-5` już istnieją. Brakuje definicji siły, agregacji po grupach i widoku.

## Desired End State

Z dashboardu użytkownik wchodzi na `/mastery` i widzi siatkę 13 grup: siła grupy (kolor + etykieta + ikona), „N/M strong”, oznaczenie „Mastered” i znaki grupy z własną siłą. Wszystko czytelne na iPhonie i iPadzie.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Siła znaku | % poprawnych z ostatnich 5 odpowiedzi, oba kierunki; <3 odpowiedzi = „Nowy” | Spójne z S-03/S-06, 1/1 nie daje fałszywej pewności | Plan |
| Progi | mocny ≥80%, średni 40–79%, słaby <40% | Proste, 4–5/5 = mocny przy oknie 5 | Plan |
| Siła grupy | najsłabszy znak (słaby > średni); brak słabych/średnich, ale są „Nowe” → „Nowy” | Nie udaje opanowania nieprzećwiczonych znaków | Plan |
| Grupa opanowana | wszystkie znaki mocne | Kolor grupy mówi, co jeszcze wymaga pracy | Plan |
| Sygnał poza kolorem | etykieta tekstowa + odmienny symbol + aria-label | Czytelne bez koloru i dla czytników ekranu | Plan |
| Układ | strona `/mastery`, 13 kafelków ze znakami, bez rozwijania | Wzorzec `/hot-5`, bez JS; rozwijanie to FR-014 | Plan |
| Dane | bez migracji, istniejące `recent_char_stats` | Dane już dostępne | Plan |

## Scope

**In scope:** logika siły i agregacji, strona `/mastery`, link z dashboardu, ochrona trasy, asercje i smoke.

**Out of scope:** rozwijanie grup (FR-014), zmiany schematu, statystyki na kierunek, przycisk „ćwicz grupę”.

## Architecture / Approach

Czysta funkcja `buildGroupMastery(stats)` w `src/lib/mastery.ts` łączy `CharStat[]` z `KANA_GROUPS`. Strona SSR `mastery.astro` czyta `getCharStats` i renderuje model w Astro, bez klienta React.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Logika siły i agregacji | `mastery.ts` + asercje w `check:session` | Poprawne granice progów (40/80%, min. 3) |
| 2. Strona /mastery i dashboard | Siatka grup, link, trasa chroniona, smoke | Czytelność 13 kafelków na iPhonie i dostępność bez koloru |

**Prerequisites:** S-02 i S-04 ukończone (dane odpowiedzi i grupy).
**Estimated effort:** ~1–2 sesje, 2 fazy.

## Open Risks & Assumptions

- Progi 80/40 przy oknie 5 są grube (krok 20%); ewentualne dostrojenie po użyciu bez zmiany struktury.
- Grupa z jednym „Nowym” znakiem nigdy nie będzie „Mastered” — celowe.

## Success Criteria (Summary)

- Użytkownik widzi, które grupy są opanowane, i siłę każdej grupy oraz znaku.
- Skala jest rozróżnialna bez koloru.
- `check:session`, lint, typy, build i smoke są zielone.
