# Zapis wyników sesji rozpoznawania — Plan Brief

> Full plan: `context/changes/save-session-results/plan.md`

## What & Why

Wyniki sesji z S-01 mają trafiać na konto użytkownika w Supabase, a każda odpowiedź (także błędna) ma być przypisana do znaku. Użytkownik widzi zapisany wynik po sesji i w historii. To wypełnia US-01 i FR-007 oraz guardrail „wyniki nie giną” i odblokowuje powtórki błędów (S-03) i statystyki (S-05, S-06).

## Starting Point

W repo są tylko trasy uwierzytelniania i klient Supabase; brak migracji, tabel i tras danych. Sesja z S-01 (zaplanowana, nie zaimplementowana) żyje wyłącznie w przeglądarce, a jej kształt (`Question`, `answers`, tabela `KANA`) jest podstawą tego planu.

## Desired End State

Każda odpowiedź ląduje w bazie pod kontem użytkownika zaraz po udzieleniu, bez opóźnienia informacji zwrotnej. Po sesji podsumowanie pokazuje wynik z bazy („X/Y” i lista pomyłek), a `/results` trzyma historię ukończonych sesji ze szczegółem. Użytkownik nie widzi cudzych danych.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Definicja wyniku | X/Y + lista pomylonych znaków | Zatwierdzone w roadmapie 2026-11-14. | Roadmap |
| Kierunek w statystyce | Oba razem, kierunek zapisany przy odpowiedzi | Późniejszy podział bez migracji danych. | Roadmap |
| Moment zapisu | Po każdej odpowiedzi | Nic nie ginie nawet przy przerwaniu sesji. | Plan |
| Model danych | `practice_sessions` + `session_answers` | Wynik sesji i odpowiedzi per znak osobno, pod S-03/S-05/S-06. | Plan |
| Błąd zapisu | Nie blokuje; kolejka ponowień i baner „Not saved — Retry” | Płynna nauka bez utraty danych przy chwilowej awarii. | Plan |
| Gdzie wynik | Podsumowanie z bazy + historia `/results` | „Zapisany wynik” widoczny także po powrocie. | Plan |
| Przerwane sesje | `completed_at = null`; odpowiedzi liczą się do statystyk, historia ich nie pokazuje | Spójne z zapisem odpowiedź po odpowiedzi. | Plan |
| Idempotencja | Klucz `(session_id, position)` | Ponowienia z kolejki nie dublują wierszy. | Plan |
| Weryfikacja | Rozszerzony smoke z lokalnym Supabase, w tym RLS dwoma kontami | Bez nowych zależności testowych, działa w istniejącym CI. | Plan |

## Scope

**In scope:** migracja z RLS, trasy API (utworzenie sesji, zapis odpowiedzi, zamknięcie, odczyt, lista), zapis w tle z ponowieniami w hooku, baner statusu, podsumowanie z bazy, strony `/results`, linki, smoke.

**Out of scope:** ważone powtórki (S-03), grupy (S-04), siła znajomości i hot-5 (S-05, S-06), trwała kolejka offline po odświeżeniu, `sendBeacon`, edycja i usuwanie danych, paginacja, ochrona przed fałszowaniem `is_correct`, Vitest/Playwright.

## Architecture / Approach

Klient tworzy sesję przy starcie (`POST /api/practice/sessions`), wysyła odpowiedzi pojedynczo w tle (`…/answers`, idempotentnie) przez kolejkę ponowień w hooku, a po ostatniej wywołuje `…/complete`, gdzie serwer liczy `score` z zapisanych odpowiedzi. Trasy API są cienkie nad serwisem `session-store` z walidacją zod; dostęp do danych egzekwuje RLS po `user_id` (rola `authenticated`, bez polityk delete). Strony `/results` czytają te same dane przez serwis.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schemat i typy | Migracja z RLS, typy DTO | Błędna polityka RLS (za szeroka lub blokująca zapis) |
| 2. API + smoke | Trasy, zod, dowód izolacji RLS | Przebudowa smoke na słoiki per klient |
| 3. Zapis w kliencie | Zapis w tle, ponowienia, baner, podsumowanie z bazy | Kolejka ponowień i stany „pending/failed” |
| 4. Historia | `/results`, szczegół, linki | Spójność wyniku z podsumowaniem |

**Prerequisites:** S-01 wdrożony (typy, `KANA`, hook i komponenty sesji); lokalny Supabase (Docker).
**Estimated effort:** ~3–4 sesje w 4 fazach.

## Open Risks & Assumptions

- Zakładamy kształt S-01 z jego planu; zmiana `Question`/`usePracticeSession` wymaga korekty fazy 3.
- Klient przysyła `is_correct` — świadome uproszczenie dla aplikacji jednoosobowej.
- Kolejka ponowień żyje w pamięci: odświeżenie karty z niezapisanymi odpowiedziami je gubi (poza zakresem).
- Smoke wymaga drugiego konta w lokalnym Supabase z autopotwierdzeniem e-mail (jak dla obecnego konta smoke).

## Success Criteria (Summary)

- Po sesji w bazie są wszystkie odpowiedzi przypisane do znaków (także błędne), a podsumowanie pokazuje zapisany wynik.
- Użytkownik wraca do `/results` i widzi historię z listą pomyłek; nikt inny jej nie widzi.
- Chwilowa awaria sieci nie blokuje nauki ani nie powoduje utraty ani dublowania odpowiedzi.
