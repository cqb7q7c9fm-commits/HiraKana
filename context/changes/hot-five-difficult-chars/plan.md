# Hot-5 — najtrudniejsze znaki — Implementation Plan

## Overview

Użytkownik widzi na chronionej stronie `/hot-5` do 5 znaków, w których myli się najczęściej (FR-012). Ranking liczy się z istniejącego okna ostatnich 5 odpowiedzi na znak (`recent_char_stats`, oba kierunki razem) — bez migracji i bez nowego zapisu. To samodzielny widok tylko do odczytu, niezależny od grup (S-04) i opanowania grup (S-05).

## Current State Analysis

- `getCharStats` (`src/lib/services/session-store.ts`, na końcu pliku) wywołuje funkcję SQL `recent_char_stats` (`supabase/migrations/20261114190000_recent_char_stats_lateral.sql`) i zwraca `CharStat[]` (`romaji`, `answers` ≤ 5, `errors` ≤ `answers`) — jeden wiersz na znak, który kiedykolwiek miał odpowiedź. Funkcja filtruje po `auth.uid()` i jest już ograniczona liczbą znaków w `KANA`.
- `GET /api/practice/stats` (`src/pages/api/practice/stats.ts`) zwraca te same dane klientowi; strona SSR może wołać `getCharStats` bezpośrednio, tak jak `/results` woła `listResults` (`src/pages/results/index.astro`).
- Nie istnieje żaden widok statystyk. `/dashboard` (`src/pages/dashboard.astro`) ma tylko przyciski „Start practice” i „Results”.
- `PROTECTED_ROUTES` w `src/middleware.ts:5` to `["/dashboard", "/practice", "/results"]`; chronione strony przekierowują na `/auth/signin`.
- `KANA` (`src/lib/kana.ts`) mapuje `romaji` → `hiragana` / `katakana`; strona szczegółów wyniku (`src/pages/results/[id].astro`) już tłumaczy `romaji` na znak tą ścieżką.
- Dane per znak liczą oba kierunki nauki razem (decyzja z S-02), a okno 5 odpowiedzi jest już definicją „ostatnich” w S-03; hot-5 używa tej samej, żeby w produkcie była jedna definicja.
- Lekcja z `context/foundation/lessons.md` (nieograniczone tworzenie wierszy per użytkownik) nie dotyczy tej zmiany: widok tylko czyta, nie tworzy wierszy ani indeksów.

## Desired End State

`/hot-5` (po zalogowaniu; bez logowania przekierowanie na `/auth/signin`) pokazuje listę 0–5 znaków uporządkowaną od najtrudniejszego. Każda pozycja ma hiraganę i katakanę, romaji oraz „błędy/odpowiedzi” z okna (np. `3/5`). Gdy w oknie nie ma żadnego błędu (także nowy użytkownik), strona pokazuje stan pusty z linkiem „Start practice”. `/dashboard` ma link do `/hot-5`.

Weryfikacja: `npm run lint`, `npx astro check`, `npm run build`, `npm run smoke` oraz ręczny test z zasianymi odpowiedziami (remisy, mniej niż 5 znaków, 0 błędów, brak logowania).

### Key Discoveries:

- Dane i ich ograniczenie (jeden wiersz na znak) już istnieją — cała nowość to czysta funkcja rankingu i widok (`session-store.ts`, `getCharStats`).
- Okno 5 odpowiedzi daje tylko odsetki co 20 pkt dla pełnych okien, więc remisy będą częste; deterministyczny remis jest częścią reguły, nie dodatkiem.
- Znak z 1 błędem w 1 odpowiedzi ma odsetek 100% i wejdzie na górę — to świadomie przyjęte (bez progu minimalnej liczby odpowiedzi), więc strona pokazuje „błędy/odpowiedzi”, żeby użytkownik widział, na ilu odpowiedziach opiera się pozycja.

## What We're NOT Doing

- Migracji ani nowej funkcji SQL (okno zostaje 5, nie całą historią i nie 10).
- Progu minimalnej liczby odpowiedzi na znak ani dopełniania listy do 5 znakami bez błędów (znak bez błędów w oknie nigdy nie jest w hot-5).
- Rozdzielania statystyk po kierunku, alfabecie ani grupie; statystyk grup i siły znajomości (S-05); wariantu „ćwicz tylko hot-5” (FR-008, poza MVP).
- Rozstrzygania remisów po dacie ostatniego błędu (wymagałoby zmiany funkcji SQL).
- Nowych testów automatycznych, w tym Playwrighta i kroków w `smoke.mjs` (decyzja: tylko test ręczny); istniejące `lint`, `astro check`, `build`, `smoke` służą jako kontrola regresji.
- Nowego endpointu API — strona SSR woła `getCharStats` bezpośrednio.

## Implementation Approach

Reguła rankingu jest wydzieloną czystą funkcją w `src/lib`, a strona tylko ją woła i renderuje; dzięki temu regułę można odczytać w jednym miejscu, a strona zostaje cienka (wzorzec `/results`). Faza 1 dostarcza działającą stronę pod bezpośrednim adresem, faza 2 dodaje wejście z dashboardu i pełną weryfikację.

Reguła rankingu (zatwierdzona w planowaniu):

- Kandydaci: tylko znaki z `errors ≥ 1` w oknie.
- Kolejność: odsetek błędów `errors / answers` malejąco; przy równym odsetku więcej błędów (`errors`) wyżej; przy dalszym remisie rosnąco po `romaji`.
- Wynik: pierwsze 5 pozycji; mniej niż 5 kandydatów daje krótszą listę, brak kandydatów pustą.
- Przykłady: `ka 1/1` i `ki 5/5` (oba 100%) → `ki`, potem `ka`; `shi 3/3` (100%) wyprzedza `tsu 4/5` (80%); `ha 0/5` nie wchodzi.

## Phase 1: Ranking i strona /hot-5

### Overview

Czysta funkcja rankingu, chroniona strona SSR i jej stany (lista, pusty).

### Changes Required:

#### 1. Funkcja rankingu

**File**: `src/lib/hot-five.ts` (nowy)

**Intent**: Zamienia `CharStat[]` na uporządkowaną listę do 5 najtrudniejszych znaków według zatwierdzonej reguły, bez dostępu do bazy ani `KANA`.

**Contract**: `export function rankHotFive(stats: readonly CharStat[], limit = 5): CharStat[]` — filtruje `errors ≥ 1`, sortuje (odsetek malejąco, potem `errors` malejąco, potem `romaji` rosnąco), zwraca `slice(0, limit)`. Odsetki porównywać krzyżowo (`a.errors * b.answers` vs `b.errors * a.answers`), nie liczbami zmiennoprzecinkowymi, żeby remisy były dokładne. Nie mutuje wejścia; `answers = 0` nie występuje z bazy, ale funkcja nie może dzielić przez zero.

#### 2. Strona widoku

**File**: `src/pages/hot-5.astro` (nowy)

**Intent**: Chroniona strona SSR w stylu `/results` (karta `bg-cosmic`, link powrotu do `/dashboard`) pokazująca ranking lub stan pusty.

**Contract**: pobiera `Astro.locals.user` / `Astro.locals.supabase` jak `src/pages/results/index.astro` (500 przy braku Supabase), wywołuje `getCharStats(supabase)` → `rankHotFive`, mapuje `romaji` na `KANA` (hiragana, katakana). Pozycja: numer 1–5, obie formy kana, `romaji`, „błędy/odpowiedzi” (np. `3/5`), tekstowy (nie tylko kolorem) sygnał; elementy listy mają czytelną nazwę dla czytników ekranu. Stan pusty: tekst o braku błędów w ostatnich odpowiedziach i link „Start practice” do `/practice`. Znak nieobecny w `KANA` jest pomijany, nie powoduje błędu.

#### 3. Ochrona trasy

**File**: `src/middleware.ts`

**Intent**: Niezalogowany użytkownik wchodzący na `/hot-5` jest przekierowany na `/auth/signin`.

**Contract**: dodać `"/hot-5"` do `PROTECTED_ROUTES` (dopasowanie `pathname === route` lub prefiks `route/` zostaje bez zmian).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Zalogowany użytkownik z błędami w 3 różnych znakach widzi dokładnie te 3 pozycje, od najtrudniejszej, z poprawnymi „błędy/odpowiedzi”
- Użytkownik bez żadnej odpowiedzi lub bez błędów w oknie widzi stan pusty z linkiem „Start practice”
- Wejście na `/hot-5` bez logowania przekierowuje na `/auth/signin`

**Implementation Note**: Po zakończeniu tej fazy i przejściu kontroli automatycznych zatrzymaj się na ręczne potwierdzenie przed fazą 2. Odpowiadające tym kryteriom pola `- [ ]` żyją w sekcji `## Progress` na dole planu.

---

## Phase 2: Wejście z dashboardu i weryfikacja reguły

### Overview

Link do widoku z `/dashboard` oraz ręczne sprawdzenie reguły na zasianych danych i regresji całości.

### Changes Required:

#### 1. Link na dashboardzie

**File**: `src/pages/dashboard.astro`

**Intent**: Użytkownik trafia do hot-5 jednym kliknięciem.

**Contract**: przycisk „Hot-5” w stylu istniejącego przycisku „Results” (`href="/hot-5"`), umieszczony pod nim, przed formularzem wylogowania; bez zmian pozostałego układu.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Auth-flow smoke test passes against a running server: `npm run smoke`

#### Manual Verification:

- Na `/dashboard` widać link „Hot-5” prowadzący do `/hot-5`, a „Back to dashboard” wraca
- Remis: znaki `ka 1/1` i `ki 5/5` (oba 100%) są ułożone `ki`, potem `ka`; pełny remis rozstrzyga kolejność alfabetyczna po romaji
- Znak z odsetkiem 0% (np. `ha 0/5`) nigdy nie pojawia się na liście
- Sześć lub więcej znaków z błędami daje dokładnie 5 pozycji; znak spoza top-5 nie jest widoczny
- Strona jest czytelna i dotykalna na iPhonie/iPadzie w Safari (szerokość ~375 px, bez poziomego scrolla)

**Implementation Note**: Po fazie 2 i przejściu kontroli automatycznych poczekaj na ręczne potwierdzenie przed zamknięciem zmiany.

---

## Testing Strategy

### Unit Tests:

- Brak nowych testów automatycznych (decyzja: tylko test ręczny). `rankHotFive` jest czystą funkcją wydzieloną tak, by dodanie sprawdzeń w stylu `scripts/check-session.mjs` było tanie, gdy reguła zacznie się zmieniać.

### Integration Tests:

- Istniejące `npm run smoke` (auth) jako kontrola regresji; bez nowych kroków dla `/hot-5`.

### Manual Testing Steps:

1. Zaloguj nowego użytkownika i otwórz `/hot-5` — stan pusty.
2. Przejdź sesję, w której celowo pomylisz 3 znaki (różne liczby błędów) — `/hot-5` pokazuje 3 pozycje w kolejności zgodnej z regułą.
3. Powtórz sesje, aż co najmniej 6 znaków będzie miało błędy w oknie — lista ma 5 pozycji.
4. Odpowiedz poprawnie 5 razy z rzędu na wcześniej błędny znak — znak schodzi z listy (okno 5).
5. Wyloguj się i otwórz `/hot-5` — przekierowanie na `/auth/signin`.

## Performance Considerations

Zapytanie to istniejące `recent_char_stats` (jedna lateral top-N na znak, indeks pokrywa `ORDER BY`), więc koszt nie rośnie z historią odpowiedzi; wynik ma najwyżej tyle wierszy, ile znaków w `KANA`. Sortowanie tej listy w pamięci jest pomijalne.

## Migration Notes

Brak migracji ani zmian schematu; cofnięcie to usunięcie strony, funkcji i linku.

## References

- Roadmap: `context/foundation/roadmap.md` (S-06), PRD `context/foundation/prd.md` (FR-012)
- Dane per znak: `src/lib/services/session-store.ts` (`getCharStats`), `supabase/migrations/20261114190000_recent_char_stats_lateral.sql`
- Wzorzec strony: `src/pages/results/index.astro`, trasy chronione: `src/middleware.ts:5`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ranking i strona /hot-5

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — dca7293
- [x] 1.2 Type checking passes: `npx astro check` — dca7293
- [x] 1.3 Production build succeeds: `npm run build` — dca7293

#### Manual

- [x] 1.4 Zalogowany użytkownik z błędami w 3 różnych znakach widzi dokładnie te 3 pozycje, od najtrudniejszej, z poprawnymi „błędy/odpowiedzi”
- [x] 1.5 Użytkownik bez żadnej odpowiedzi lub bez błędów w oknie widzi stan pusty z linkiem „Start practice”
- [x] 1.6 Wejście na `/hot-5` bez logowania przekierowuje na `/auth/signin`

### Phase 2: Wejście z dashboardu i weryfikacja reguły

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Type checking passes: `npx astro check`
- [x] 2.3 Production build succeeds: `npm run build`
- [x] 2.4 Auth-flow smoke test passes against a running server: `npm run smoke`

#### Manual

- [x] 2.5 Na `/dashboard` widać link „Hot-5” prowadzący do `/hot-5`, a „Back to dashboard” wraca
- [x] 2.6 Remis: `ka 1/1` i `ki 5/5` (oba 100%) są ułożone `ki`, potem `ka`; pełny remis rozstrzyga kolejność alfabetyczna po romaji
- [x] 2.7 Znak z odsetkiem 0% (np. `ha 0/5`) nigdy nie pojawia się na liście
- [x] 2.8 Sześć lub więcej znaków z błędami daje dokładnie 5 pozycji; znak spoza top-5 nie jest widoczny
- [x] 2.9 Strona jest czytelna i dotykalna na iPhonie/iPadzie w Safari (szerokość ~375 px, bez poziomego scrolla)
