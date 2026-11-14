# Error weighted repeats (S-03) Implementation Plan

## Overview

Sesja rozpoznawania dobiera dziś 10 unikalnych znaków losowo. Ta zmiana wprowadza dobór ważony historią błędów użytkownika (FR-006): znak, w którym użytkownik się mylił, pojawia się w sesji więcej razy niż znak opanowany. Sesja nadal ma 10 pytań, a znak powtarza się najwyżej 3 razy (FR-005). Historia pochodzi z `session_answers` zapisanych w S-02.

## Current State Analysis

- `buildSession` (`src/lib/services/session.ts:16`) losuje `SESSION_LENGTH = 10` unikalnych znaków (`shuffle(entries).slice(0, 10)`), więc dziś nic się nie powtarza. Funkcja jest czysta, `random` jest wstrzykiwany.
- Klient buduje sesję sam: `usePracticeSession.start` (`src/components/hooks/usePracticeSession.ts:19`) wywołuje `buildSession(KANA, …)` synchronicznie i od razu przechodzi do kroku `question`.
- Historia: tabela `session_answers` (`supabase/migrations/20261114120000_practice_sessions.sql`) ma `romaji`, `is_correct`, `direction`, `answered_at`, a RLS pozwala na odczyt tylko własnych wierszy. Znak identyfikuje `romaji`, więc statystyka łączy hiraganę i katakanę oraz oba kierunki (decyzja z S-02, `roadmap.md`).
- Indeks `session_answers_user_romaji_idx` został usunięty (`20261114170000_drop_unused_romaji_index.sql`) z komentarzem, że wraca razem z pierwszym czytelnikiem (S-03/S-06). `context/foundation/lessons.md` wymaga tego samego: indeks tylko razem z pierwszym czytelnikiem.
- Zapis odpowiedzi działa dla powtórzonych znaków bez zmian: klucz główny to `(session_id, position)`, a nie znak (`session-store.ts`, `saveAnswer`). Schemat `saveAnswerSchema` nie wymaga unikalności `romaji`.
- Istnieje zero-dependency `scripts/check-session.mjs` (seedowany PRNG `seeded()`, `npm run check:session`, uruchamiany w CI) testujący niezmienniki `buildSession`. Brak test runnera.
- Wzorce API: `requireUser`, `withErrors`, `json` w `src/lib/http.ts`; endpoint z `export const prerender = false` i zod (`src/pages/api/practice/sessions/index.ts`).

## Desired End State

Użytkownik z historią błędów dostaje w kolejnej sesji znaki z błędami częściej (do 3 razy), a znaki bez błędów co najwyżej raz. Użytkownik bez historii, a także użytkownik, dla którego nie udało się pobrać statystyk, dostaje sesję identyczną jak dziś (10 unikalnych znaków, jednostajny los). Weryfikacja: `npm run check:session` (logika), `npm run smoke` (endpoint + RLS), ręczny scenariusz „pomyl się, zagraj ponownie”.

### Key Discoveries:

- Okno historii to ostatnie 5 odpowiedzi na znak; nie da się go wyliczyć poprawnie z prostego `limit N` na całej tabeli, bo rzadkie znaki wypadłyby z wyniku. Potrzebne jest zapytanie okienkowe (`row_number() over (partition by romaji …)`).
- `buildSession` bez historii musi pozostać „jak dziś”, więc znak bez błędów ma limit 1 w sesji, a powtórki dotyczą tylko znaków z błędami.
- Zapytanie jest ograniczone z natury (max 46 wierszy na użytkownika), więc nie narusza zasady z `lessons.md` o niekontrolowanym tworzeniu zasobów (endpoint tylko czyta).

## What We're NOT Doing

- Zmian UI: brak informowania użytkownika o wagach ani oznaczania powtórek.
- Osobnych statystyk per kierunek (zapisujemy `direction`, ale statystyka liczy oba razem — decyzja z S-02).
- Grup znaków (S-04), widoku hot-5 (S-06), siły znajomości (S-05), trybu „tylko błędne znaki” (FR-008).
- Zmiany doboru błędnych opcji (dystraktorów) w pytaniu.
- Zmiany długości sesji (zostaje `SESSION_LENGTH = 10`) ani schematu `practice_sessions`/`session_answers`.
- Dodawania Vitest ani innego test runnera (rozszerzamy `check:session`).

## Implementation Approach

Trzy fazy, od czystej logiki do integracji: (1) ważony `buildSession` z asercjami w `check:session`, (2) odczyt statystyk po stronie serwera (migracja z indeksem i funkcją okienkową, serwis, endpoint GET), (3) pobranie statystyk w kliencie z fallbackiem na równe wagi i podpięcie do `start`.

Reguła doboru (uzgodniona): `errorRate = errors / answers` z ostatnich ≤5 odpowiedzi na znak; `weight = 1 + 3 × errorRate`; brak historii → `errorRate = 0` (waga 1). Limit powtórzeń w sesji: znak z `errorRate > 0` — 3, znak z `errorRate = 0` — 1. Pytania losowane są kolejno z puli znaków, które nie wyczerpały limitu, z prawdopodobieństwem proporcjonalnym do wagi. Dwa identyczne pytania nigdy nie sąsiadują.

## Phase 1 / Faza 1: Ważony dobór w `buildSession`

### Overview

Czysta logika doboru z wstrzykiwanym `random`, pokryta asercjami w istniejącym `scripts/check-session.mjs`. Bez dotykania bazy i UI.

### Changes Required:

#### 1. Typ statystyki znaku

**File**: `src/types.ts`

**Intent**: Dodać wspólny typ statystyki znaku używany przez dobór (faza 1), serwis i endpoint (faza 2) oraz klienta (faza 3).

**Contract**: `export interface CharStat { romaji: string; answers: number; errors: number }` — `answers` to liczba uwzględnionych (ostatnich ≤5) odpowiedzi, `errors` ≤ `answers`.

#### 2. Ważony `buildSession`

**File**: `src/lib/services/session.ts`

**Intent**: Dodać `weightOf(stat)` oraz dobór `SESSION_LENGTH` pytań wg reguły z „Implementation Approach”, zachowując zachowanie bez historii (10 unikalnych znaków, jednostajnie).

**Contract**: `export const MAX_REPEATS = 3`; `export function weightOf(stat: CharStat | undefined): number` (`1 + 3 × errors/answers`, brak statystyki lub `answers = 0` → 1); `buildSession(entries, alphabet, direction, random = Math.random, stats: ReadonlyMap<string, CharStat> = new Map()): Question[]`. Niezmienniki: dokładnie `SESSION_LENGTH` pytań; znak bez błędów ≤1 raz; znak z błędami ≤`MAX_REPEATS` razy; żadne dwa kolejne pytania nie dotyczą tego samego znaku; opcje i `correctIndex` budowane dla każdego pytania osobno, jak dziś. Pusta mapa daje te same gwarancje co obecnie (unikalne znaki). Nietrywialne: losowanie kolejno z puli o ograniczonym limicie i rozplątanie sąsiadujących duplikatów (np. przez przestawienie) — rozplątanie musi zawsze się udawać dla limitu 3 przy 10 pytaniach.

#### 3. Asercje w skrypcie sprawdzającym

**File**: `scripts/check-session.mjs`

**Intent**: Dodać do istniejącego skryptu (seedowany PRNG, ten sam styl `assert`) sprawdzenia ważonego doboru, zachowując dotychczasowe asercje dla pustych statystyk.

**Contract**: Sprawdzenia: (a) pusta mapa → 10 unikalnych znaków jak dotąd; (b) wiele iteracji z ustalonym znakiem o `errors = answers` → ≤3 wystąpienia w sesji i średnio wyraźnie więcej niż znaku z `errors = 0` (np. ≥ 2× częściej, próg dobrany pod seedowane iteracje); (c) znak z `errors = 0` nigdy >1 raz; (d) brak sąsiadujących duplikatów; (e) `weightOf`: brak statystyki → 1, `errors = answers` → 4, `errors = 0` → 1.

### Success Criteria:

#### Automated Verification:

- Skrypt logiki sesji przechodzi (stare i nowe asercje): `npm run check:session`
- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`

---

## Phase 2 / Faza 2: Odczyt statystyk po stronie serwera

### Overview

Migracja z indeksem i funkcją okienkową, serwis w `session-store.ts` oraz `GET /api/practice/stats`, objęte smoke testem (w tym RLS dwóch kont).

### Changes Required:

#### 1. Migracja: indeks i funkcja statystyk

**File**: `supabase/migrations/20261114180000_recent_char_stats.sql`

**Intent**: Przywrócić indeks pod pierwszego czytelnika (zgodnie z `lessons.md`) i dodać funkcję zwracającą statystykę ostatnich 5 odpowiedzi na znak dla bieżącego użytkownika.

**Contract**: Indeks `session_answers_user_romaji_answered_idx` na `session_answers (user_id, romaji, answered_at desc)`. Funkcja `public.recent_char_stats(window_size int default 5)` → `table (romaji text, answers int, errors int)`; `language sql stable security invoker` (RLS obowiązuje), dodatkowo filtr `user_id = (select auth.uid())`; wyliczenie przez `row_number() over (partition by romaji order by answered_at desc)` ≤ `window_size`, agregat `count(*)` i `count(*) filter (where not is_correct)`. `execute` tylko dla `authenticated` (revoke dla `public`/`anon`). Zgodnie z CLAUDE.md: żadnej nowej tabeli, więc bez nowych polityk RLS.

#### 2. Serwis odczytu

**File**: `src/lib/services/session-store.ts`

**Intent**: Dodać funkcję czytającą statystyki przez RPC i mapującą wiersze na `CharStat[]`, w stylu pozostałych funkcji (rzuca `Error` z kontekstem przy błędzie bazy).

**Contract**: `export async function getCharStats(supabase: SupabaseClient, userId: string): Promise<CharStat[]>` (wywołanie `supabase.rpc("recent_char_stats")`); wynik ograniczony przez dziedzinę do ≤46 wierszy.

#### 3. Endpoint

**File**: `src/pages/api/practice/stats.ts`

**Intent**: Udostępnić statystyki klientowi do zbudowania sesji.

**Contract**: `export const prerender = false`; `GET: APIRoute` owinięte w `withErrors`, `requireUser` → `json(CharStat[])`; 401 bez sesji (jak pozostałe trasy). Brak wejścia do walidacji zodem (GET bez parametrów).

#### 4. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć endpoint i izolację użytkowników w istniejącym przepływie (dwa konta `emailA`/`emailB` już istnieją w skrypcie).

**Contract**: (a) bez logowania `GET /api/practice/stats` → 401; (b) po zapisaniu kilku odpowiedzi (w tym błędnych) przez konto A odpowiedź zawiera odpowiednie `answers`/`errors`; (c) po >5 odpowiedziach na jeden znak okno obejmuje tylko 5 ostatnich; (d) konto B nie widzi statystyk konta A.

### Success Criteria:

#### Automated Verification:

- Migracje stosują się od zera: `npx supabase db reset`
- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`
- Smoke test (z nowym endpointem i RLS) przechodzi przeciw lokalnemu Supabase: `npm run smoke`

---

## Phase 3 / Faza 3: Podpięcie w kliencie z fallbackiem

### Overview

`start` pobiera statystyki, przekazuje je do `buildSession`, a przy braku odpowiedzi startuje z pustymi statystykami (zachowanie jak dziś). Aktualizacja roadmapy.

### Changes Required:

#### 1. Pobranie statystyk w kliencie

**File**: `src/components/hooks/useCharStats.ts` (nowy; hooki w `src/components/hooks/` wg CLAUDE.md)

**Intent**: Zamknąć pobranie `GET /api/practice/stats` i zamianę na `Map<string, CharStat>` z twardym fallbackiem, który nigdy nie blokuje ćwiczenia.

**Contract**: Funkcja zwracająca `Promise<ReadonlyMap<string, CharStat>>`; przy każdym błędzie (sieć, status ≠ 200, nieprawidłowy kształt, przekroczenie krótkiego limitu czasu, np. przez `AbortSignal.timeout`) zwraca pustą mapę, bez wyjątku. Kształt odpowiedzi sprawdzany jawnie (nie zakładać typu).

#### 2. `start` jako operacja asynchroniczna

**File**: `src/components/hooks/usePracticeSession.ts` (oraz `src/components/practice/SetupStep.tsx` / `PracticeApp.tsx` w zakresie niezbędnym do zablokowania przycisku)

**Intent**: Przed zbudowaniem sesji poczekać na statystyki (z limitem czasu), potem zbudować sesję przez `buildSession(KANA, alphabet, direction, Math.random, stats)` i zacząć jak dziś. Zapobiec podwójnemu startowi podczas oczekiwania.

**Contract**: `start` zwraca `Promise<void>`; dodany stan `starting` (przycisk startu wyłączony, `startAgain` korzysta z tej samej ścieżki); wszystkie dotychczasowe efekty (`sync.begin`, reset stanów) wykonują się dopiero po zbudowaniu sesji. Brak zmian tekstów i układu poza stanem wyłączonym przycisku. Wynik odpowiedzi nie jest cache'owany między sesjami (każdy start = świeże statystyki, w tym `startAgain`, żeby dopiero co popełnione błędy od razu wpływały).

#### 3. Roadmapa

**File**: `context/foundation/roadmap.md`

**Intent**: Zapisać rozstrzygnięcie niewiadomej S-03 w sekcji `Decisions` (okno 5 odpowiedzi, waga `1 + 3 × odsetek błędów`, limity powtórzeń 3/1, stała długość 10).

**Contract**: Dodać wpis `Decisions` do S-03 i usunąć niewiadomą „Dokładna reguła ‘częściej’”; status zmienia dopiero `/10x-implement`/`/10x-archive`.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzanie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`
- Skrypt logiki sesji przechodzi: `npm run check:session`
- Smoke test przechodzi: `npm run smoke`

#### Manual Verification:

- Nowy użytkownik (bez historii) dostaje sesję 10 unikalnych znaków
- Po sesji, w której pomylisz się w 2–3 znakach, kolejna sesja zawiera te znaki 2–3 razy, a znaki bez błędów co najwyżej raz
- Po serii poprawnych odpowiedzi na wcześniej błędny znak (ostatnie 5 poprawne) wraca on do pojedynczego występowania
- Przy zablokowanym lub zwracającym 500 `GET /api/practice/stats` sesja startuje normalnie (bez powtórzeń) i nie ma komunikatu błędu
- Szybkie podwójne kliknięcie „start” nie tworzy dwóch sesji

**Implementation Note**: Po zakończeniu fazy i przejściu weryfikacji automatycznej wstrzymaj się na ręczne potwierdzenie przez człowieka, zanim przejdziesz dalej. Pola wyboru `- [ ]` dla tych punktów znajdują się w sekcji `## Progress` na dole planu.

---

## Testing Strategy

### Unit Tests:

- `weightOf` dla braku statystyki, 0% i 100% błędów, wartości pośrednich
- `buildSession`: limity powtórzeń (3 dla znaków z błędami, 1 dla pozostałych), brak sąsiadujących duplikatów, pusta mapa = unikalne znaki, rozkład (znak błędny średnio ≥2× częściej)
- Całość w `scripts/check-session.mjs` z seedowanym PRNG (deterministycznie)

### Integration Tests:

- `npm run smoke`: 401 bez logowania, poprawny agregat, okno 5 odpowiedzi, izolacja kont (RLS)

### Manual Testing Steps:

1. Zaloguj nowe konto, zagraj sesję i sprawdź, że znaki się nie powtarzają
2. Pomyl się celowo w 2–3 znakach, zacznij „Practice again” i sprawdź powtórki
3. Odpowiedz poprawnie na te znaki w kolejnych sesjach i sprawdź powrót do pojedynczego występowania
4. Zablokuj `/api/practice/stats` w narzędziach deweloperskich i sprawdź start sesji

## Performance Considerations

Jedno zapytanie okienkowe na start sesji; wynik ≤46 wierszy, obsługiwane indeksem `(user_id, romaji, answered_at desc)`. Limit czasu pobrania w kliencie ogranicza opóźnienie startu do kilku sekund w najgorszym przypadku. Mierzalny cel czasu reakcji pozostaje otwartym pytaniem produktu (PRD, Open Questions 3).

## Migration Notes

Jedna migracja dodająca indeks i funkcję; brak zmian danych, brak backfillu. Wycofanie: `drop function public.recent_char_stats(int); drop index public.session_answers_user_romaji_answered_idx;` — klient przy błędzie endpointu i tak przechodzi na równe wagi.

## References

- Roadmap: `context/foundation/roadmap.md` (S-03, FR-006); PRD: `context/foundation/prd.md` (FR-005, FR-006)
- Lessons: `context/foundation/lessons.md` (indeks razem z pierwszym czytelnikiem)
- Obecny dobór: `src/lib/services/session.ts:16`; start sesji: `src/components/hooks/usePracticeSession.ts:19`
- Zapis odpowiedzi i wzorce serwisu: `src/lib/services/session-store.ts`; wzorzec endpointu: `src/pages/api/practice/sessions/index.ts`
- Wcześniejsza zmiana: `context/archive/2026-11-14-save-session-results/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ważony dobór w buildSession

#### Automated

- [x] 1.1 Skrypt logiki sesji przechodzi (stare i nowe asercje): `npm run check:session` — 7d75c69
- [x] 1.2 Linting przechodzi: `npm run lint` — 7d75c69
- [x] 1.3 Sprawdzanie typów przechodzi: `npx astro check` — 7d75c69

### Phase 2: Odczyt statystyk po stronie serwera

#### Automated

- [x] 2.1 Migracje stosują się od zera: `npx supabase db reset` — 3215f1b
- [x] 2.2 Linting przechodzi: `npm run lint` — 3215f1b
- [x] 2.3 Sprawdzanie typów przechodzi: `npx astro check` — 3215f1b
- [x] 2.4 Build przechodzi: `npm run build` — 3215f1b
- [x] 2.5 Smoke test (z nowym endpointem i RLS) przechodzi przeciw lokalnemu Supabase: `npm run smoke` — 3215f1b

### Phase 3: Podpięcie w kliencie z fallbackiem

#### Automated

- [x] 3.1 Linting przechodzi: `npm run lint`
- [x] 3.2 Sprawdzanie typów przechodzi: `npx astro check`
- [x] 3.3 Build przechodzi: `npm run build`
- [x] 3.4 Skrypt logiki sesji przechodzi: `npm run check:session`
- [x] 3.5 Smoke test przechodzi: `npm run smoke`

#### Manual

- [ ] 3.6 Nowy użytkownik (bez historii) dostaje sesję 10 unikalnych znaków
- [ ] 3.7 Po sesji z 2–3 pomyłkami kolejna sesja zawiera te znaki 2–3 razy, a znaki bez błędów co najwyżej raz
- [ ] 3.8 Po serii poprawnych odpowiedzi na wcześniej błędny znak (ostatnie 5 poprawne) wraca on do pojedynczego występowania
- [ ] 3.9 Przy zablokowanym lub zwracającym 500 `GET /api/practice/stats` sesja startuje normalnie, bez powtórzeń i bez komunikatu błędu
- [ ] 3.10 Szybkie podwójne kliknięcie „start” nie tworzy dwóch sesji
