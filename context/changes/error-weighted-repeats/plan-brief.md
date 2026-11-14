# Error weighted repeats (S-03) — Plan Brief

> Full plan: `context/changes/error-weighted-repeats/plan.md`

## What & Why

Aplikacja ma częściej powtarzać znaki, w których użytkownik się mylił (FR-006): błędny znak pojawia się w sesji więcej razy niż znak opanowany. To główny wgląd produktu — nauka skupiona na błędach, możliwa dzięki historii odpowiedzi zapisanej w S-02.

## Starting Point

Sesja to dziś 10 unikalnych, losowych znaków budowanych w kliencie (`buildSession`), bez korzystania z historii. Historia leży w `session_answers` (znak = `romaji`, oba alfabety i kierunki razem), a indeks pod takie zapytania został usunięty do czasu pierwszego czytelnika. W repo działa zero-dependency `check:session` (seedowany PRNG, w CI).

## Desired End State

Użytkownik z błędami w historii dostaje w kolejnej sesji te znaki do 3 razy, a znaki bez błędów co najwyżej raz. Użytkownik bez historii lub przy awarii odczytu statystyk dostaje sesję dokładnie jak dziś. UI się nie zmienia (poza wyłączonym przyciskiem startu na czas pobierania).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Okno historii | Ostatnie 5 odpowiedzi na znak | Znak szybko wraca do „opanowanego” po serii poprawnych | Plan |
| Reguła „częściej” | Waga `1 + 3 × odsetek błędów`, losowanie ważone | Gładka skala, opanowane znaki wciąż się zdarzają | Plan |
| Limity powtórzeń | Znak z błędami ≤3, bez błędów ≤1 | Spełnia FR-005 i zachowuje zachowanie „jak dziś” bez historii (wyprowadzone z powyższych decyzji) | Plan |
| Długość sesji | Stałe 10 pytań | Brak zmian w UI, API i historii wyników | Plan |
| Gdzie liczyć | Endpoint zwraca agregat, klient waży, fallback na równe wagi | Ćwiczenie nigdy się nie blokuje (guardrail „wyniki nie giną”) | Plan |
| Testy | Rozszerzenie `check:session` (bez Vitest) | Istniejący wzorzec, zero zależności, już w CI | Plan |
| Znak vs kierunek | Oba kierunki i alfabety razem | Decyzja z S-02 (`roadmap.md`) | Roadmap |
| Indeks | Przywrócony razem z pierwszym czytelnikiem | Wymóg `lessons.md` | Lessons |

## Scope

**In scope:** ważony `buildSession`, funkcja SQL + indeks + endpoint `GET /api/practice/stats`, pobranie w kliencie z fallbackiem, asercje w `check:session` i `smoke`, wpis w roadmapie.

**Out of scope:** zmiany UI/informowanie o wagach, statystyki per kierunek, grupy (S-04), hot-5 (S-06), siła znajomości (S-05), FR-008, dobór dystraktorów, Vitest.

## Architecture / Approach

Klient przed startem pobiera `GET /api/practice/stats` (≤46 wierszy z funkcji okienkowej `recent_char_stats`, RLS po stronie bazy), zamienia je na mapę `romaji → {answers, errors}` i przekazuje do czystej funkcji `buildSession`, która losuje pytania kolejno z puli znaków o niewyczerpanym limicie, z prawdopodobieństwem proporcjonalnym do wagi, i rozplątuje sąsiadujące duplikaty. Każdy błąd pobrania daje pustą mapę, czyli dzisiejsze zachowanie.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Ważony dobór | `weightOf`, ważony `buildSession`, asercje w `check:session` | Rozplątanie sąsiednich duplikatów musi zawsze się udać; progi rozkładu w teście |
| 2. Odczyt statystyk | Migracja (indeks + funkcja), serwis, endpoint, smoke z RLS | Poprawność okna „ostatnie 5” i uprawnień funkcji |
| 3. Klient | `useCharStats`, asynchroniczny `start` z fallbackiem, roadmapa | Opóźnienie startu i podwójne kliknięcie |

**Prerequisites:** S-02 (zrobione); lokalny Supabase do `db reset` i `smoke`.
**Estimated effort:** ~2–3 sesje, 3 fazy.

## Open Risks & Assumptions

- Mnożnik 3 i okno 5 to strojenie; mogą wymagać korekty po użyciu (łatwe: stałe w jednym miejscu).
- Znak bez historii traktowany jak opanowany (waga 1, limit 1) — nowe znaki nie są wyróżniane.
- Odpowiedzi z porzuconych sesji też liczą się do statystyki (zapisane odpowiedzi są prawdziwymi próbami).

## Success Criteria (Summary)

- Po sesji z pomyłkami kolejna sesja zawiera te znaki 2–3 razy, a opanowane najwyżej raz.
- Użytkownik bez historii lub przy awarii odczytu nie widzi różnicy względem dzisiejszej sesji.
- `check:session`, `smoke`, lint, `astro check` i build przechodzą.
