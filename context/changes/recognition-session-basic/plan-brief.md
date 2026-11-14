# Sesja rozpoznawania znaków z informacją zwrotną — Plan Brief

> Full plan: `context/changes/recognition-session-basic/plan.md`

## What & Why

Budujemy pierwszy kompletny przepływ produktu (wycinek S-01): zalogowany użytkownik wybiera alfabet i kierunek, przechodzi sesję 10 znaków z 4 opcjami i po każdej odpowiedzi widzi, czy była dobra. To najmniejszy przepływ, który dowodzi, że trener rozpoznawania znaków działa, i odblokowuje zapis wyników (S-02) oraz powtórki błędów (S-03).

## Starting Point

Logowanie e-mailem i ochrona tras w middleware już działają, ale po zalogowaniu użytkownik widzi tylko szablonową stronę powitalną i pusty dashboard. Nie ma danych znaków, tras aplikacji, tabel ani testów poza smoke przepływu auth.

## Desired End State

Na chronionej stronie `/practice` użytkownik przechodzi pełną sesję w przeglądarce: pytanie, wybór spośród 4 opcji, komunikat „Correct”/„Incorrect” z poprawną parą, a na końcu wynik `X/10` z listą pomyłek. Wejście jest z dashboardu i `Topbar`; niezalogowany jest odsyłany na logowanie.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Dobór 3 błędnych opcji | Losowe znaki z tego samego alfabetu | Najprostsze i mieści się w 3 tygodniach; zaostrzenie możliwe później. | Plan |
| Zakres znaków | 46 podstawowych (gojūon) na alfabet | Pełny zestaw dla początkującego bez dakuten i kombinacji. | Plan |
| Stan sesji | Tylko w przeglądarce, bez API i tabel | Najmniej kodu i natychmiastowa reakcja; zapis dochodzi w S-02. | Plan |
| Punkt wejścia | Nowa chroniona trasa `/practice` | Nie zmienia przekierowania po logowaniu, więc smoke zostaje zgodny. | Plan |
| Długość sesji | 10 różnych znaków, bez powtórek | Spełnia 10–15 i limit 3 powtórek bez ważenia; powtórki to S-03. | Plan |
| Weryfikacja logiki | Skrypt `check:session` zamiast runnera testów | Repozytorium nie ma runnera, a logika jest czysta i wstrzykiwalna. | Plan |
| Język interfejsu | Angielski | Spójny z istniejącymi ekranami auth (`lang="en"`). | Plan |

## Scope

**In scope:** dane 46 znaków, czysta logika sesji, strona `/practice` z wyspą React, informacja zwrotna niezależna od samego koloru, podsumowanie z listą pomyłek, linki z dashboardu i `Topbar`, rozszerzenie smoke, skrypt `check:session`.

**Out of scope:** zapis wyników i API (S-02), powtórki błędów (S-03), grupy i widoki postępu (S-04–S-06), dakuten i kombinacje, podobne dystraktory, biblioteka testów, zmiany w CI i w przekierowaniu po logowaniu.

## Architecture / Approach

Czysta funkcja `buildSession(entries, alphabet, direction, random)` w `src/lib/services/session.ts` buduje 10 pytań z tabeli `KANA` (`src/lib/kana.ts`). Hook `usePracticeSession` trzyma stan i przejścia kroków (wybór → pytanie → informacja zwrotna → podsumowanie), a cienkie komponenty w `src/components/practice/` renderują kroki. Strona Astro `practice.astro` jest chroniona w middleware i montuje wyspę React.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dane i logika sesji | Typy, 46 znaków, `buildSession`, skrypt `check:session` | Błąd w tabeli znaków lub zapisie Hepburna |
| 2. Strona i interfejs | `/practice`, hook, komponenty, linki, ochrona trasy | Czytelność i cele dotykowe na iPhonie/iPadzie |
| 3. Weryfikacja | Smoke dla `/practice`, przegląd na wąskim ekranie, status roadmapy | Smoke wymaga lokalnego Supabase |

**Prerequisites:** F-01 (CI na `main`) jest ukończone; do `npm run smoke` potrzebny jest lokalny Supabase i działający serwer.
**Estimated effort:** ~3 sesje po jednej na fazę.

## Open Risks & Assumptions

- PRD mówi o „dwuliterowym zapisie”, ale Hepburn ma `shi`, `chi`, `tsu`, `fu`; przyjęto Hepburna.
- Odświeżenie strony w trakcie sesji gubi stan; to świadoma konsekwencja braku zapisu do czasu S-02.
- US-01 mówi o „statystykach”; w S-01 błędny znak jest oznaczony i widoczny na liście pomyłek, a trwałe statystyki dochodzą w S-02.
- `check:session` zakłada Node z obsługą TypeScript (usuwanie typów); lokalnie jest Node 22, więc faza 1 weryfikuje, że skrypt działa, i w razie potrzeby przełącza się na wersję z `.nvmrc`.
- Język interfejsu (angielski) jest założeniem; zmiana na polski nie dotyka logiki.

## Success Criteria (Summary)

- Zalogowany użytkownik przechodzi pełną sesję w obu alfabetach i obu kierunkach i po każdej odpowiedzi widzi wynik.
- Niezalogowany użytkownik nie ma dostępu do `/practice`.
- `check:session`, lint, typy, build i smoke przechodzą; strona jest użyteczna na szerokości iPhone’a i iPada.
