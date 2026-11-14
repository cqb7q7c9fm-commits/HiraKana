# Group mastery view Implementation Plan

## Overview

Nowa strona `/mastery` pokazuje 13 grup znaków i siłę znajomości każdej grupy oraz każdego znaku w 3-stopniowej skali (słaby / średni / mocny), z drugim sygnałem poza kolorem (etykieta + ikona). Grupa jest „opanowana”, gdy każdy jej znak jest mocny. Realizuje S-05 (FR-010, FR-011).

## Current State Analysis

- `recent_char_stats(window_size=5)` zwraca na znak `answers` i `errors` z ostatnich 5 odpowiedzi (oba kierunki razem) — `supabase/migrations/20261114190000_recent_char_stats_lateral.sql`. Odczyt: `getCharStats()` w `src/lib/services/session-store.ts:218`.
- `KANA` i `KANA_GROUPS` (13 grup, `members` = romaji) w `src/lib/kana.ts:79`. Każdy znak należy do dokładnie jednej grupy.
- `/hot-5` (`src/pages/hot-5.astro`) + `src/lib/hot-five.ts` to gotowy wzorzec: strona SSR, `getCharStats`, czysta funkcja rankingu, link z dashboardu.
- Roadmapa blokowała S-05 niezdefiniowanymi progami; zostały rozstrzygnięte w tym planie.

## Desired End State

Zalogowany użytkownik wchodzi z dashboardu na `/mastery` i widzi siatkę 13 grup. Każdy kafelek grupy pokazuje jej siłę (kolor + etykieta + ikona), licznik „N/M mocnych” i znaki grupy, każdy z własną siłą. Grupa z samymi mocnymi znakami jest oznaczona jako opanowana.

### Key Discoveries:

- Statystyka okna 5 jest już liczona w bazie, więc faza danych nie wymaga migracji (`session-store.ts:218`).
- Wzorzec „czysta funkcja w `src/lib/` + asercje w `scripts/check-session.mjs`” (importuje `.ts` bezpośrednio) obowiązuje dla logiki.
- Brak nowych wierszy per użytkownik, więc lekcja o limitach zasobów nie dotyczy tej zmiany.

## What We're NOT Doing

- Rozwijania/zwijania grup (FR-014, nice-to-have); znaki są widoczne zawsze.
- Zmian schematu, nowych funkcji SQL i nowych endpointów API.
- Osobnych statystyk na kierunek nauki (statystyka znaku liczy oba razem — decyzja z S-02).
- Przycisku „ćwicz tę grupę” z kafelka (poza zakresem).
- Gwarantowanej kolejności „Nowy” w skali: „Nowy” to stan neutralny poza 3-stopniową skalą.

## Implementation Approach

Czysta logika w `src/lib/mastery.ts`, wołana ze strony SSR `/mastery`. Strona czyta `getCharStats`, buduje model grup i renderuje go w Astro (bez React, bez JS po stronie klienta).

Reguły (zatwierdzone przez usera, 2026-11-14):

- Okno: ostatnie 5 odpowiedzi znaku, oba kierunki; `correct = answers − errors`.
- Znak z `answers < 3` (lub bez odpowiedzi) = **Nowy** (poza skalą).
- Znak z `answers ≥ 3`: odsetek poprawnych `correct/answers` — **mocny** ≥ 80%, **średni** 40–79%, **słaby** < 40%. Porównanie na liczbach całkowitych (`correct*100 >= 80*answers`), bez float.
- Siła grupy: jeśli jakikolwiek znak słaby → słaba; w przeciwnym razie jeśli jakikolwiek średni → średnia; w przeciwnym razie jeśli jakikolwiek Nowy → **Nowy** (grupa bez słabych/średnich, ale nie w pełni przećwiczona); w przeciwnym razie (wszystkie mocne) → mocna i **opanowana**.
- Grupa bez żadnej odpowiedzi = Nowy, „0/N mocnych”.
- Drugi sygnał: etykieta tekstowa i odmienny symbol (np. ▲ mocny / ◆ średni / ▼ słaby / ○ Nowy) oraz `aria-label`; kolor jest uzupełnieniem.

## Phase 1: Logika siły i agregacji

### Overview

Czysty moduł klasyfikacji i agregacji, w pełni sprawdzalny bez serwera i bazy.

### Changes Required:

#### 1. Moduł siły znajomości

**File**: `src/lib/mastery.ts` (nowy)

**Intent**: Klasyfikuje znak, liczy siłę grupy i opanowanie, i buduje model widoku z `CharStat[]` oraz `KANA_GROUPS`/`KANA`.

**Contract**: `type Strength = "weak" | "medium" | "strong" | "new"`; `strengthOf(stat?: CharStat): Strength`; `buildGroupMastery(stats: readonly CharStat[]): GroupMastery[]` w kolejności `KANA_GROUPS`, gdzie `GroupMastery = { id, label, strength, mastered, strongCount, total, chars: { romaji, hiragana, katakana, strength }[] }`. Stałe progów (`MIN_ANSWERS = 3`, `STRONG_PERCENT = 80`, `MEDIUM_PERCENT = 40`) eksportowane i opisane jednym zdaniem. Statystyka dla romaji spoza `KANA` jest pomijana.

#### 2. Asercje

**File**: `scripts/check-session.mjs`

**Intent**: Dodaje niezmienniki mastery do istniejącego skryptu `npm run check:session`.

**Contract**: Sprawdza przypadki brzegowe: 1/1 poprawne → Nowy; 2/2 → Nowy; 3/3 → mocny; 4/5 poprawnych (80%) → mocny; 3/5 (60%) i 2/5 (40%) → średni; 1/5 (20%) i 0/3 → słaby; brak statystyki → Nowy. Grupy: wszystkie mocne → mocna + opanowana; 4 mocne + 1 Nowy → Nowy, nieopanowana; mocne + 1 słaby → słaba; 1 średni + reszta mocnych → średnia; brak danych → Nowy; łączna liczba znaków w grupach = `KANA.length`.

### Success Criteria:

#### Automated Verification:

- Niezmienniki logiki mastery przechodzą: `npm run check:session`
- Sprawdzenie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- Progi i priorytet siły grupy w `src/lib/mastery.ts` są zgodne z regułami w tym planie i czytelne bez testów

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie człowieka.

---

## Phase 2: Strona /mastery i wejście z dashboardu

### Overview

Strona SSR z siatką grup oraz link z dashboardu; weryfikacja wizualna i dostępności.

### Changes Required:

#### 1. Strona widoku

**File**: `src/pages/mastery.astro` (nowy)

**Intent**: Pobiera `getCharStats`, buduje `buildGroupMastery` i renderuje 13 kafelków grup w stylu `/hot-5`. Strona wymaga logowania.

**Contract**: Dodaj `/mastery` do `PROTECTED_ROUTES` w `src/middleware.ts`. Kafelek: nagłówek grupy (label) + znacznik siły (kolor + symbol + etykieta „Weak/Medium/Strong/New”) + „N/M strong” + opis „Mastered” dla opanowanej + rząd znaków (hiragana, katakana, romaji, znacznik siły). Każdy znacznik ma `aria-label` z pełnym opisem (np. „ka: Medium”). Mała legenda skali u góry. Siatka jednokolumnowa na iPhonie, wielokolumnowa od `sm`/`md`; bez poziomego scrolla. Błąd `getCharStats` nie jest połykany (ten sam wzorzec co `/hot-5`).

#### 2. Wejście z dashboardu

**File**: `src/pages/dashboard.astro`

**Intent**: Dodaje link „Mastery” obok „Hot-5”, w tym samym stylu.

**Contract**: `<a href="/mastery">` z klasami identycznymi jak link Hot-5; strona zawiera „← Back to dashboard”.

#### 3. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Zachowuje obecny przepływ i dodaje sprawdzenie, że niezalogowany `/mastery` przekierowuje na `/auth/signin`.

**Contract**: Analogicznie do istniejącej asercji dla `/hot-5` lub `/practice` (jeśli istnieje); w przeciwnym razie jedna nowa asercja przekierowania.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build produkcyjny przechodzi: `npm run build`
- Smoke przechodzi na działającym serwerze: `npm run smoke`

#### Manual Verification:

- Nowy użytkownik bez odpowiedzi widzi 13 grup w stanie „New” i „0/N strong”
- Po sesji grupy K z 5/5 poprawnymi w oknie, K jest „Strong” i „Mastered”, a pozostałe grupy „New”
- Znak z 2 błędami w ostatnich 3 odpowiedziach jest „Weak”, a jego grupa „Weak” nawet gdy reszta jest mocna
- Skala jest odróżnialna bez koloru (etykieta i symbol widoczne przy wyłączonych kolorach lub w skali szarości)
- Na `/dashboard` widać link „Mastery” prowadzący do `/mastery`, a „Back to dashboard” wraca
- Strona jest czytelna i dotykalna na iPhonie/iPadzie w Safari (≈375 px i ≈820 px, bez poziomego scrolla)

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie człowieka.

---

## Testing Strategy

### Unit Tests:

- Logika mastery w `scripts/check-session.mjs` (progi na granicach 40/80%, minimum 3 odpowiedzi, priorytet siły grupy, suma znaków = `KANA.length`).

### Integration Tests:

- Smoke: przekierowanie niezalogowanego z `/mastery`.

### Manual Testing Steps:

1. Zaloguj nowe konto → `/mastery`: 13 grup „New”.
2. Zrób sesję grupy K z samymi poprawnymi odpowiedziami (≥3 na każdy znak) → K „Strong”/„Mastered”.
3. Zrób błędy na jednym znaku → jego znacznik „Weak”, grupa „Weak”.
4. Sprawdź widok w skali szarości i na wąskim ekranie.

## Performance Considerations

Jedno wywołanie RPC `recent_char_stats` (jeden wiersz na znak, ≤ `KANA.length`) i agregacja po stałej tablicy 13 grup; brak wpływu na wydajność.

## Migration Notes

Brak migracji ani zmian danych. Po dostarczeniu zaktualizować status S-05 w roadmapie i zapisać zatwierdzone progi w `Decisions` (robi to `/10x-implement`/`/10x-archive`).

## References

- Roadmapa: `context/foundation/roadmap.md` (S-05, Open Questions 6–7), PRD: FR-010, FR-011, FR-013
- Wzorzec: `src/pages/hot-5.astro`, `src/lib/hot-five.ts`
- Dane: `src/lib/services/session-store.ts:218`, `src/lib/kana.ts:79`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Logika siły i agregacji

#### Automated

- [x] 1.1 Niezmienniki logiki mastery przechodzą: `npm run check:session` — fdc406c
- [x] 1.2 Sprawdzenie typów przechodzi: `npx astro check` — fdc406c
- [x] 1.3 Linting przechodzi: `npm run lint` — fdc406c

#### Manual

- [x] 1.4 Progi i priorytet siły grupy w `src/lib/mastery.ts` są zgodne z regułami w planie i czytelne bez testów — fdc406c

### Phase 2: Strona /mastery i wejście z dashboardu

#### Automated

- [x] 2.1 Linting przechodzi: `npm run lint` — 873d312 — b61b69a
- [x] 2.2 Sprawdzenie typów przechodzi: `npx astro check` — 873d312 — b61b69a
- [x] 2.3 Build produkcyjny przechodzi: `npm run build` — 873d312 — b61b69a
- [x] 2.4 Smoke przechodzi na działającym serwerze: `npm run smoke` — 873d312 — b61b69a

#### Manual

- [x] 2.5 Nowy użytkownik bez odpowiedzi widzi 13 grup w stanie „New” i „0/N strong” — 873d312 — b61b69a
- [x] 2.6 Po sesji grupy K z 5/5 poprawnymi w oknie, K jest „Strong” i „Mastered”, a pozostałe grupy „New” — 873d312 — b61b69a
- [x] 2.7 Znak z 2 błędami w ostatnich 3 odpowiedziach jest „Weak”, a jego grupa „Weak” nawet gdy reszta jest mocna — 873d312 — b61b69a
- [x] 2.8 Skala jest odróżnialna bez koloru (etykieta i symbol widoczne w skali szarości) — 873d312 — b61b69a
- [x] 2.9 Na `/dashboard` widać link „Mastery” prowadzący do `/mastery`, a „Back to dashboard” wraca — 873d312 — b61b69a
- [x] 2.10 Strona jest czytelna i dotykalna na iPhonie/iPadzie w Safari (≈375 px i ≈820 px, bez poziomego scrolla) — b61b69a
