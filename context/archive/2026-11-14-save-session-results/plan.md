# Zapis wyników sesji rozpoznawania — Implementation Plan

## Overview

Wycinek S-02 z roadmapy: wyniki sesji z S-01 trafiają na konto użytkownika w Supabase. Każda odpowiedź jest zapisywana na serwerze zaraz po udzieleniu (z ponowieniami przy awarii), jest przypisana do znaku, także błędna (US-01), a użytkownik widzi zapisany wynik na ekranie podsumowania oraz na stronie historii `/results`. Wynik to „X/Y” plus lista pomylonych znaków (decyzja roadmapy z 2026-11-14).

## Current State Analysis

- Zależność: S-01 (`recognition-session-basic`) jest zaplanowany, ale nie zaimplementowany. Ten plan zakłada jego kształt: `Question`, `Direction`, `Alphabet` w `src/types.ts`, tabelę `KANA` w `src/lib/kana.ts` (46 znaków, klucz `romaji`), hook `usePracticeSession` z `answers` oraz strony `/practice`. Implementację S-02 zaczynamy po wdrożeniu S-01.
- W repo nie ma `supabase/migrations/`, tras API aplikacji ani tabel. Istnieją tylko trasy auth (`src/pages/api/auth/*`) i klient `createClient` w `src/lib/supabase.ts`.
- `src/middleware.ts` ustawia `context.locals.user` i chroni trasy z `PROTECTED_ROUTES`; trasy API mogą korzystać z `locals.user` i `createClient(...)`.
- `scripts/smoke.mjs` używa jednego globalnego słoika cookies i tablicy kroków `[nazwa, funkcja, oczekiwany status/location]`; `request` zwraca tylko status i `location`, bez ciała odpowiedzi.
- PRD: „wyniki nie giną”, „każdy widzi tylko swoje wyniki”, płaski model użytkowników.

## Desired End State

Zalogowany użytkownik przechodzi sesję, a każda odpowiedź ląduje w bazie pod jego kontem w tle, bez opóźnienia informacji zwrotnej. Po ostatnim pytaniu podsumowanie pokazuje wynik odczytany z bazy. Pod `/results` jest lista ostatnich ukończonych sesji (data, alfabet, kierunek, X/Y), a po kliknięciu szczegół z listą znaków, w których użytkownik się pomylił. Użytkownik A nie widzi danych użytkownika B. Weryfikacja: `npm run smoke` (zapis, odczyt, izolacja RLS), `npm run check:session`, `npm run lint`, `npx astro check`, `npm run build` oraz ręczne przejście sesji z odłączoną siecią w trakcie.

### Key Discoveries:

- `src/middleware.ts:4` — `PROTECTED_ROUTES` to prefiksy ścieżek; `"/results"` obejmie stronę historii. Trasy `/api/practice/*` nie są chronione przez middleware, więc handlery same odrzucają brak `locals.user` kodem 401.
- `src/lib/supabase.ts` — klient SSR czyta sesję z cookies; zapytania z nim wykonują się jako `authenticated`, więc RLS działa bez klucza serwisowego.
- `scripts/smoke.mjs` — `request` nie zwraca ciała i nie obsługuje JSON; do testów API trzeba go rozszerzyć, a globalny `jar` zastąpić słoikiem per klient, aby sprawdzić izolację dwoma kontami.
- CLAUDE.md: API z uppercase `GET`/`POST` i `export const prerender = false`, walidacja zod, typy w `src/types.ts`, logika w `src/lib/services/`, migracje `YYYYMMDDHHmmss_short_description.sql` z RLS i politykami per operację i rolę.
- `zod` nie jest w `package.json`; CLAUDE.md wymaga go dla tras API, więc faza 2 dodaje zależność.

## What We're NOT Doing

- Powtórek błędnych znaków i ważenia losowania (S-03), grup znaków (S-04), siły znajomości, skali kolorów i hot-5 (S-05, S-06). Dane z tego wycinka im wystarczą, ale agregaty ich nie powstają tutaj.
- Rozdzielania statystyk według kierunku — kierunek jest tylko zapisywany przy każdej odpowiedzi.
- Zapisu częściowych odpowiedzi przy zamknięciu karty (`sendBeacon`), kolejki offline trwałej po odświeżeniu strony (kolejka ponowień żyje w pamięci hooka) ani wznawiania przerwanych sesji.
- Usuwania lub edycji sesji i odpowiedzi przez użytkownika oraz paginacji historii (lista ostatnich 20 sesji).
- Ochrony przed fałszowaniem `is_correct` przez klienta (aplikacja jednoosobowa, bez rankingów; serwer waliduje tylko znak i kierunek).
- Runnera testów jednostkowych (Vitest) i Playwrighta; weryfikacja idzie przez rozszerzony smoke.
- Zmian w istniejących formularzach auth i przekierowaniu po logowaniu.

## Implementation Approach

Cztery fazy od danych do UI. Faza 1 to schemat i typy (bez kodu uruchomieniowego). Faza 2 dodaje trasy API i dowód RLS w smoke, zanim ruszy UI. Faza 3 podłącza klienta: sesja jest tworzona przy starcie, odpowiedzi wysyłane w tle z kolejką ponowień, a zamknięcie sesji liczy wynik po stronie serwera. Faza 4 dodaje stronę historii. Przerwane sesje zostają z `completed_at = null`: ich odpowiedzi nadal liczą się do statystyk znaków, ale historia pokazuje tylko ukończone sesje. Zapis odpowiedzi jest idempotentny po `(session_id, position)`, więc ponowienia nie dublują wierszy.

## Phase 1: Schemat danych i typy

### Overview

Migracja z dwiema tabelami i RLS oraz typy współdzielone i schematy walidacji.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_practice_sessions.sql` (nowy; znacznik czasu z dnia implementacji)

**Intent**: Dwie tabele: sesje i odpowiedzi, z RLS ograniczającym dostęp do wierszy właściciela.

**Contract**: `practice_sessions(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, alphabet text check in ('hiragana','katakana'), direction text check in ('kana-to-romaji','romaji-to-kana'), total smallint not null check (total between 1 and 50), score smallint null, created_at timestamptz default now(), completed_at timestamptz null)`. `session_answers(session_id uuid references practice_sessions on delete cascade, position smallint not null, user_id uuid not null, romaji text not null, direction text (check jak wyżej), is_correct boolean not null, answered_at timestamptz default now(), primary key (session_id, position))`. Indeksy: `practice_sessions(user_id, completed_at desc)` oraz `session_answers(user_id, romaji)` (pod S-03/S-06). RLS włączone na obu tabelach; polityki per operację, tylko rola `authenticated`: sessions — select/insert/update gdzie `user_id = auth.uid()`; answers — select oraz insert z `user_id = auth.uid()` i warunkiem, że sesja o danym `session_id` należy do `auth.uid()`. Brak polityk delete (odmowa domyślna) i brak update na answers. `score` ustawia zamknięcie sesji, nie klient.

#### 2. Typy współdzielone

**File**: `src/types.ts` (rozszerzenie pliku z S-01)

**Intent**: DTO dla tras i klienta, wspólne z modelem bazy.

**Contract**: Dodaje `SessionRecord { id; alphabet: Alphabet; direction: Direction; total: number; score: number | null; createdAt: string; completedAt: string | null }`, `AnswerRecord { position: number; romaji: string; direction: Direction; isCorrect: boolean }` oraz `SessionResult { session: SessionRecord; mistakes: string[] }` (`mistakes` to `romaji` pomylonych znaków w kolejności pytań).

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie: `npx supabase db reset`
- Sprawdzenie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- W Supabase Studio obie tabele mają włączone RLS i dokładnie wymienione polityki (bez delete)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: API zapisu i odczytu

### Overview

Trasy tworzenia sesji, zapisu odpowiedzi, zamknięcia sesji i odczytu wyników, plus rozszerzony smoke z dowodem izolacji RLS.

### Changes Required:

#### 1. Schematy walidacji i serwis

**File**: `src/lib/services/session-store.ts` (nowy), `package.json` (zależność `zod`)

**Intent**: Jedno miejsce z walidacją zod i zapytaniami do bazy, żeby trasy były cienkie.

**Contract**: Funkcje przyjmujące klienta Supabase i `userId`: `createSession(alphabet, direction, total)`, `saveAnswer(sessionId, { position, romaji, isCorrect })` (upsert z `ignoreDuplicates`, więc ponowienie jest idempotentne; kierunek bierze z sesji; `romaji` walidowane względem zbioru z `KANA`; `position` w `0..total-1`), `completeSession(sessionId)` (liczy `score` jako liczbę poprawnych odpowiedzi; ustawia `completed_at` tylko, gdy liczba zapisanych odpowiedzi równa się `total`; powtórne wywołanie na ukończonej sesji zwraca ten sam wynik), `getResult(sessionId)` i `listResults(limit)`. Schematy zod eksportowane do tras. Nowa zależność `zod`.

#### 2. Trasy API

**File**: `src/pages/api/practice/sessions/index.ts`, `src/pages/api/practice/sessions/[id]/answers.ts`, `src/pages/api/practice/sessions/[id]/complete.ts`, `src/pages/api/practice/sessions/[id].ts` (nowe)

**Intent**: Cienkie handlery JSON nad serwisem.

**Contract**: Wszystkie z `export const prerender = false`. Brak `locals.user` → 401; zły JSON lub niezgodność ze schematem zod → 400; cudza lub nieistniejąca sesja → 404. `POST /api/practice/sessions` → 201 `{ id }`. `POST …/[id]/answers` → 200 (także przy ponowieniu tej samej pozycji). `POST …/[id]/complete` → 200 `SessionResult`, a gdy brakuje odpowiedzi → 409 z liczbą brakujących. `GET …/[id]` → 200 `SessionResult`. `GET /api/practice/sessions` → 200 `SessionRecord[]` ukończonych sesji, malejąco po dacie, max 20.

#### 3. Smoke dla API i RLS

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować w CI zapisu, odczytu i izolacji danych dwóch użytkowników.

**Contract**: Globalny `jar` zastąpiony słoikiem per klient (np. fabryka `createClient(email)`), a `request` dostaje opcję `json` i zwraca także sparsowane ciało; istniejące kroki auth zachowują zachowanie. Nowe kroki: anonim → 401 na `POST /api/practice/sessions`; użytkownik A tworzy sesję i zapisuje odpowiedzi (z powtórzeniem jednej pozycji — nadal 200 i jeden wiersz), `complete` przed zapisem wszystkich → 409, po wszystkich → 200 z poprawnym `score` i `mistakes`; użytkownik B dostaje 404 na `GET` sesji A i nie widzi jej na liście; zły `romaji` → 400.

### Success Criteria:

#### Automated Verification:

- Smoke (zapis, odczyt, 401/404/409/400, izolacja RLS) przechodzi na działającym serwerze z lokalnym Supabase: `npm run smoke`
- Build produkcyjny przechodzi: `npm run build`
- Linting i typy przechodzą: `npm run lint && npx astro check`

#### Manual Verification:

- W Supabase Studio po smoke wiersze mają poprawne `user_id`, `direction`, `is_correct` i `score` ukończonej sesji

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Zapis w kliencie

### Overview

Hook sesji z S-01 tworzy sesję na serwerze, wysyła odpowiedzi w tle z kolejką ponowień, a podsumowanie pokazuje wynik z bazy.

### Changes Required:

#### 1. Zapis w tle w hooku

**File**: `src/components/hooks/usePracticeSession.ts`, `src/components/hooks/useAnswerSync.ts` (nowy)

**Intent**: Informacja zwrotna po odpowiedzi pojawia się natychmiast, a zapis nie blokuje nauki i nie gubi odpowiedzi przy chwilowej awarii.

**Contract**: `start` wywołuje `POST /api/practice/sessions`; do czasu odpowiedzi serwera odpowiedzi użytkownika trafiają do kolejki. `answer` wysyła odpowiedź do kolejki bez czekania; kolejka wysyła po jednej pozycji, a przy błędzie sieci lub 5xx zachowuje element i ponawia przy następnej odpowiedzi i przy zamknięciu sesji (z ograniczoną liczbą prób w ramach jednego opróżniania). Odpowiedź 401 zatrzymuje kolejkę i ustawia stan „sesja wygasła”. Hook udostępnia `syncStatus: "saved" | "pending" | "failed"` i `retry()`. Po ostatniej odpowiedzi hook opróżnia kolejkę i wywołuje `complete`; wynik z odpowiedzi zasila podsumowanie. Przerwanie sesji nie wywołuje niczego dodatkowego (sesja zostaje nieukończona).

#### 2. Baner i podsumowanie

**File**: `src/components/practice/SyncBanner.tsx` (nowy), `src/components/practice/SummaryStep.tsx`, `src/components/practice/PracticeApp.tsx`

**Intent**: Użytkownik wie, czy wynik jest zapisany, a podsumowanie pokazuje dane z bazy zamiast stanu lokalnego.

**Contract**: `SyncBanner` w regionie `aria-live="polite"` pokazuje „Saving…”, „Saved” albo „Not saved — Retry” (tekst, nie sam kolor). `SummaryStep` pokazuje wynik `score/total` i listę pomyłek z `SessionResult` zwróconego przez `complete`; gdy zapis się nie udał, pokazuje wynik lokalny z komunikatem „Not saved” i przyciskiem „Retry”. Teksty po angielsku, spójnie z S-01.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji nadal przechodzą: `npm run check:session`
- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build produkcyjny przechodzi: `npm run build`

#### Manual Verification:

- Po pełnej sesji w Supabase Studio jest 10 odpowiedzi z poprawnymi `romaji`, kierunkiem i `is_correct` oraz sesja z `completed_at` i `score`
- Błędna odpowiedź ma w bazie `is_correct = false` i pojawia się na liście pomyłek w podsumowaniu
- Odłączenie sieci w trakcie sesji nie blokuje nauki, baner pokazuje „Not saved”, a po przywróceniu sieci i „Retry” zapisują się wszystkie odpowiedzi (bez duplikatów)
- Odświeżenie strony w połowie sesji zostawia sesję nieukończoną (`completed_at` pusty), a dotychczasowe odpowiedzi są w bazie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Historia wyników

### Overview

Chroniona strona `/results` z listą ostatnich ukończonych sesji i szczegółem sesji.

### Changes Required:

#### 1. Strony historii

**File**: `src/pages/results/index.astro`, `src/pages/results/[id].astro` (nowe), `src/middleware.ts`

**Intent**: Użytkownik może wrócić następnego dnia i zobaczyć zapisane wyniki.

**Contract**: `PROTECTED_ROUTES` zawiera `"/results"`. Strony SSR korzystają z serwisu `listResults` i `getResult` przez `createClient`, w stylu `dashboard.astro` (`Layout`, `bg-cosmic`). Lista: data, alfabet, kierunek, `score/total`, link do szczegółu; pusty stan z linkiem „Start practice”. Szczegół: `score/total` i lista pomylonych znaków z poprawnymi zapisami; cudza lub nieistniejąca sesja → 404.

#### 2. Linki do historii

**File**: `src/components/Topbar.astro`, `src/pages/dashboard.astro`, `src/components/practice/SummaryStep.tsx`

**Intent**: Wejście do historii z istniejących ekranów po zalogowaniu.

**Contract**: `Topbar` (gałąź zalogowanego) i dashboard dostają link „Results” do `/results`; podsumowanie sesji dostaje link „View history”.

#### 3. Smoke dla stron

**File**: `scripts/smoke.mjs`

**Intent**: Ochrona i render stron historii w CI.

**Contract**: Kroki: `/results` jako anonim → 302 `/auth/signin`; po zalogowaniu `/results` → 200; szczegół cudzej sesji → 404.

### Success Criteria:

#### Automated Verification:

- Smoke przechodzi na działającym serwerze: `npm run smoke`
- Build produkcyjny przechodzi: `npm run build`
- Linting i typy przechodzą: `npm run lint && npx astro check`

#### Manual Verification:

- Lista pokazuje ukończone sesje od najnowszej, a nieukończone się nie pojawiają
- Szczegół sesji pokazuje wynik i pomyłki zgodne z tym, co widział użytkownik po sesji
- Na szerokości iPhone’a (≈390 px) i iPada (≈820 px) strony nie mają poziomego przewijania
- Drugie konto nie widzi sesji pierwszego (ani na liście, ani przez bezpośredni adres)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak runnera testów (decyzja: bez Vitest). `scripts/check-session.mjs` z S-01 pozostaje bez zmian i nadal musi przechodzić.

### Integration Tests:

- `scripts/smoke.mjs` na lokalnym Supabase: 401 dla anonima; zapis i idempotentne ponowienie odpowiedzi; 409 przy zamknięciu niekompletnej sesji; poprawny `score` i `mistakes`; 400 dla nieznanego `romaji`; izolacja RLS drugim kontem (404 i pusta lista); ochrona i render `/results`.

### Manual Testing Steps:

1. Zaloguj się, przejdź pełną sesję z co najmniej jedną celowo błędną odpowiedzią i sprawdź podsumowanie oraz wiersze w Studio.
2. W trakcie sesji odłącz sieć, odpowiedz na 2 pytania, przywróć sieć, użyj „Retry” i sprawdź brak duplikatów.
3. Odśwież stronę w połowie sesji i sprawdź, że sesja nie trafia do historii, a odpowiedzi są w bazie.
4. Otwórz `/results` jako to samo i drugie konto; na iPhonie i iPadzie.

## Performance Considerations

Zapis jest w tle, więc informacja zwrotna nie czeka na sieć. Odpowiedzi idą pojedynczo (10 żądań na sesję) — przy skali „ja i garstka osób” to pomijalne; zbiorcze wysyłanie jest możliwą optymalizacją po MVP. Indeksy na `(user_id, completed_at desc)` i `(user_id, romaji)` wystarczają dla listy i przyszłych agregatów.

## Migration Notes

Pierwsza migracja w repozytorium; baza jest dziś pusta, więc brak danych do migrowania. Kierunek zapisywany przy każdej odpowiedzi pozwala w przyszłości rozdzielić statystyki bez zmiany schematu. Wdrożenie: `npx supabase db push` na zdalnej bazie przed wdrożeniem aplikacji; CI smoke używa lokalnego Supabase z migracji.

## References

- Roadmap: `context/foundation/roadmap.md` (S-02, decyzje z 2026-11-14), PRD: `context/foundation/prd.md` (US-01, FR-007, FR-013, „Access Control”)
- Zależność: `context/changes/recognition-session-basic/plan.md` (typy, `KANA`, `usePracticeSession`, komponenty `practice/*`)
- Wzorzec ochrony tras: `src/middleware.ts:4`; klient Supabase: `src/lib/supabase.ts`
- Wzorzec kroków smoke: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat danych i typy

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie: `npx supabase db reset` — e14e5e4
- [x] 1.2 Sprawdzenie typów przechodzi: `npx astro check` — e14e5e4
- [x] 1.3 Linting przechodzi: `npm run lint` — e14e5e4

#### Manual

- [x] 1.4 W Supabase Studio obie tabele mają włączone RLS i dokładnie wymienione polityki (bez delete) — e14e5e4

### Phase 2: API zapisu i odczytu

#### Automated

- [x] 2.1 Smoke (zapis, odczyt, 401/404/409/400, izolacja RLS) przechodzi na działającym serwerze z lokalnym Supabase: `npm run smoke` — 09fa9db
- [x] 2.2 Build produkcyjny przechodzi: `npm run build` — 09fa9db
- [x] 2.3 Linting i typy przechodzą: `npm run lint && npx astro check` — 09fa9db

#### Manual

- [x] 2.4 W Supabase Studio po smoke wiersze mają poprawne `user_id`, `direction`, `is_correct` i `score` ukończonej sesji — 09fa9db

### Phase 3: Zapis w kliencie

#### Automated

- [x] 3.1 Niezmienniki sesji nadal przechodzą: `npm run check:session` — 73be8e9
- [x] 3.2 Linting przechodzi: `npm run lint` — 73be8e9
- [x] 3.3 Sprawdzenie typów przechodzi: `npx astro check` — 73be8e9
- [x] 3.4 Build produkcyjny przechodzi: `npm run build` — 73be8e9

#### Manual

- [x] 3.5 Po pełnej sesji w Supabase Studio jest 10 odpowiedzi z poprawnymi `romaji`, kierunkiem i `is_correct` oraz sesja z `completed_at` i `score` — 73be8e9
- [x] 3.6 Błędna odpowiedź ma w bazie `is_correct = false` i pojawia się na liście pomyłek w podsumowaniu — 73be8e9
- [x] 3.7 Odłączenie sieci w trakcie sesji nie blokuje nauki, baner pokazuje „Not saved”, a po przywróceniu sieci i „Retry” zapisują się wszystkie odpowiedzi (bez duplikatów) — 73be8e9
- [x] 3.8 Odświeżenie strony w połowie sesji zostawia sesję nieukończoną (`completed_at` pusty), a dotychczasowe odpowiedzi są w bazie — 73be8e9

### Phase 4: Historia wyników

#### Automated

- [x] 4.1 Smoke przechodzi na działającym serwerze: `npm run smoke` — dceee74
- [x] 4.2 Build produkcyjny przechodzi: `npm run build` — dceee74
- [x] 4.3 Linting i typy przechodzą: `npm run lint && npx astro check` — dceee74

#### Manual

- [x] 4.4 Lista pokazuje ukończone sesje od najnowszej, a nieukończone się nie pojawiają — dceee74
- [x] 4.5 Szczegół sesji pokazuje wynik i pomyłki zgodne z tym, co widział użytkownik po sesji — dceee74
- [x] 4.6 Na szerokości iPhone’a (≈390 px) i iPada (≈820 px) strony nie mają poziomego przewijania — dceee74
- [x] 4.7 Drugie konto nie widzi sesji pierwszego (ani na liście, ani przez bezpośredni adres) — dceee74
