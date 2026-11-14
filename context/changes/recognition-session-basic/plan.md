# Sesja rozpoznawania znaków z informacją zwrotną — Implementation Plan

## Overview

Wycinek S-01 z roadmapy: zalogowany użytkownik wchodzi na chronioną stronę `/practice`, wybiera alfabet (hiragana lub katakana) i kierunek nauki, przechodzi sesję 10 różnych znaków z 4 opcjami odpowiedzi i po każdej odpowiedzi widzi, czy była dobra. Na końcu dostaje podsumowanie z listą pomyłek. Stan sesji żyje wyłącznie w przeglądarce; zapis wyników (S-02) i powtórki błędów (S-03) są poza zakresem.

## Current State Analysis

- Logowanie e-mailem działa (`src/pages/api/auth/*`, `src/middleware.ts`). Po zalogowaniu `signin.ts` przekierowuje na `/`, który renderuje tylko szablonowy `Welcome`; `dashboard.astro` to pusta strona powitalna.
- Brak tras aplikacji, danych znaków, typów współdzielonych (`src/types.ts` nie istnieje), tabel i migracji.
- React jest używany tylko w formularzach auth (`src/components/auth/*`) i `ui/button.tsx` (shadcn, wariant new-york).
- Jedyną siatką bezpieczeństwa jest `scripts/smoke.mjs` (przepływ auth przez HTTP); brak testów jednostkowych i E2E, brak runnera testów.
- UI istniejących ekranów jest po angielsku (`<html lang="en">`, teksty w `SignInForm`) i używa klasy `bg-cosmic` z półprzezroczystymi kartami.

## Desired End State

Zalogowany użytkownik wchodzi na `/practice` (link z dashboardu i `Topbar`), wybiera alfabet i kierunek, odpowiada na 10 pytań, po każdej odpowiedzi widzi „Correct”/„Incorrect” oraz poprawną parę znak ↔ zapis łaciński, a na końcu wynik `X/10` i listę błędnie rozpoznanych znaków. Niezalogowany użytkownik jest przekierowany na `/auth/signin`. Weryfikacja: `npm run check:session`, `npm run lint`, `npx astro check`, `npm run build`, `npm run smoke` oraz ręczne przejście sesji na wąskim ekranie.

### Key Discoveries:

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`; wystarczy dopisać `"/practice"`, aby objąć nową stronę ochroną.
- `src/pages/api/auth/signin.ts` — po logowaniu `context.redirect("/")`, a `scripts/smoke.mjs` oczekuje dokładnie `/`; dlatego wejście do ćwiczenia jest nową trasą, a nie zmianą przekierowania.
- `src/components/Welcome.astro:18` — `Topbar` jest widoczny po zalogowaniu i zawiera link do dashboardu; to naturalne miejsce na link do `/practice`.
- `scripts/smoke.mjs` — kroki to tablica `[nazwa, funkcja, oczekiwany status/location]`; nowe kroki dopisuje się bez zmian w runnerze.
- `tsconfig.json` — alias `@/*` → `./src/*` działa w Astro/Vite, ale nie w samym Node; logika sesji nie może więc mieć wartościowych importów przez alias, jeśli ma być sprawdzana skryptem Node.
- CLAUDE.md: komponenty React tylko tam, gdzie potrzebna interaktywność; hooki w `src/components/hooks/`; typy współdzielone w `src/types.ts`; logika w `src/lib/services/`; klasy łączyć przez `cn()`.

## What We're NOT Doing

- Zapisu wyników i odpowiedzi do bazy, migracji i tras API (S-02); podsumowanie nie twierdzi, że wynik został zapisany.
- Powtórek błędnych znaków w sesji i ważenia losowania (S-03, FR-006). Znak powtarza się w sesji 0 razy, więc limit „max 3 razy” (FR-005) jest spełniony trywialnie.
- Grup znaków, dakuten, kombinacji (np. `が`, `きゃ`) i widoków postępu (S-04, S-05, S-06).
- Dystraktorów dobieranych według podobieństwa lub rzędu tabeli kana; wszystkie 3 błędne opcje są losowe z tego samego alfabetu.
- Biblioteki do testów jednostkowych, Playwrighta i zmian w `.github/workflows/ci.yml` (skrypt `check:session` jest uruchamiany lokalnie).
- Zmiany przekierowania po logowaniu i istniejących formularzy auth.
- Mierzalnego celu „płynnej reakcji” (otwarte pytanie roadmapy, nie blokuje).

## Implementation Approach

Trzy fazy od logiki do interfejsu. Faza 1 dostarcza dane znaków i czystą logikę budowy sesji (bez zależności od Astro i React), którą da się zweryfikować skryptem Node. Faza 2 podłącza ją do chronionej strony i wyspy React ze stanem w hooku. Faza 3 domyka weryfikację: smoke dla nowej trasy, ręczne przejście na wąskim ekranie i synchronizacja statusu roadmapy.

Założenie językowe: teksty interfejsu są po angielsku, spójnie z istniejącymi ekranami auth (`lang="en"`); zmiana języka jest osobną, niezależną decyzją.

## Phase 1: Dane znaków i logika sesji

### Overview

Tabela 46 znaków gojūon (hiragana i katakana z zapisem łacińskim Hepburna) oraz czysta funkcja budująca sesję 10 pytań z 4 opcjami.

### Changes Required:

#### 1. Typy współdzielone

**File**: `src/types.ts` (nowy)

**Intent**: Wspólne typy domeny ćwiczenia dla danych, logiki i UI.

**Contract**: Eksportuje `Alphabet = "hiragana" | "katakana"`, `Direction = "kana-to-romaji" | "romaji-to-kana"`, `KanaEntry { romaji: string; hiragana: string; katakana: string }` oraz `Question { entry: KanaEntry; prompt: string; options: string[]; correctIndex: number }`. `prompt` i `options` są już gotowymi napisami do wyświetlenia dla wybranego alfabetu i kierunku.

#### 2. Tabela znaków

**File**: `src/lib/kana.ts` (nowy)

**Intent**: Jedno źródło prawdy dla 46 znaków podstawowych, wspólne dla obu alfabetów, aby uniknąć rozjazdu hiragana/katakana.

**Contract**: Eksportuje `KANA: readonly KanaEntry[]` z dokładnie 46 wierszami (a, i, u, e, o; ka…ko; sa…so; ta…to; na…no; ha…ho; ma…mo; ya, yu, yo; ra…ro; wa, wo; n). Zapis łaciński wg Hepburna (`shi`, `chi`, `tsu`, `fu`, `wo`, `n`) — część zapisów ma więc 3 litery, mimo sformułowania „dwuliterowy” w PRD. Wszystkie `romaji`, `hiragana` i `katakana` są unikalne. Plik nie ma żadnych importów wartościowych.

#### 3. Budowa sesji

**File**: `src/lib/services/session.ts` (nowy)

**Intent**: Wylosować sesję 10 różnych znaków i dla każdego pytania 3 losowe dystraktory z tego samego alfabetu, z poprawną odpowiedzią na losowej pozycji.

**Contract**: Eksportuje `SESSION_LENGTH = 10`, `OPTION_COUNT = 4` oraz `buildSession(entries: readonly KanaEntry[], alphabet: Alphabet, direction: Direction, random: () => number = Math.random): Question[]`. Tablica znaków jest parametrem (a nie importem), a `random` wstrzykiwalne, aby funkcję dało się sprawdzić skryptem Node bez aliasu `@/`. Plik ma wyłącznie `import type`. Niezmienniki: `SESSION_LENGTH` pytań o różnych znakach; każde pytanie ma `OPTION_COUNT` unikalnych opcji; `options[correctIndex]` jest poprawną odpowiedzią; dla `kana-to-romaji` `prompt` to znak wybranego alfabetu, a opcje to zapisy łacińskie; dla `romaji-to-kana` odwrotnie.

#### 4. Skrypt sprawdzający logikę

**File**: `scripts/check-session.mjs` (nowy), `package.json`

**Intent**: Dać fazom 1–2 automatyczny dowód niezmienników logiki, skoro repozytorium nie ma runnera testów.

**Contract**: Skrypt bez zależności importuje `src/lib/kana.ts` i `src/lib/services/session.ts` bezpośrednio (Node z obsługą TypeScript przez usuwanie typów; importy względne z rozszerzeniem `.ts` w skrypcie) i dla obu alfabetów i obu kierunków, w pętli wielu losowań, sprawdza niezmienniki z punktu 3, a także, że `KANA` ma 46 unikalnych wierszy. Kończy się kodem ≠ 0 przy pierwszym naruszeniu. Do `package.json` dochodzi `"check:session": "node scripts/check-session.mjs"`.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji i tabeli znaków przechodzą: `npm run check:session`
- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`

#### Manual Verification:

- Tabela `KANA` jest zgodna z tabelą gojūon (46 wierszy, Hepburn, `wo`, `n`) po przeglądzie w pliku

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Strona /practice i interfejs sesji

### Overview

Chroniona strona z wyspą React obsługującą kroki: wybór → pytanie → informacja zwrotna → podsumowanie. Linki do strony z dashboardu i `Topbar`.

### Changes Required:

#### 1. Ochrona trasy i strona

**File**: `src/middleware.ts`, `src/pages/practice.astro` (nowy)

**Intent**: Strona ćwiczenia dostępna tylko po zalogowaniu, w tym samym stylu wizualnym co dashboard.

**Contract**: `PROTECTED_ROUTES` zawiera `"/practice"`. `practice.astro` używa `Layout` (tytuł „Practice”), kontener w stylu `bg-cosmic` i montuje `PracticeApp` z `client:load`. Strona SSR, bez `export const prerender`.

#### 2. Hook stanu sesji

**File**: `src/components/hooks/usePracticeSession.ts` (nowy)

**Intent**: Cała logika przejść między krokami poza komponentami, aby UI było cienkie.

**Contract**: Zwraca `{ step, alphabet, direction, questions, index, selected, answers, score, start(alphabet, direction), answer(optionIndex), next(), restart() }`. `step ∈ "setup" | "question" | "feedback" | "summary"`. `start` wywołuje `buildSession(KANA, …)` i przechodzi do `question`; `answer` ignoruje drugie kliknięcie tego samego pytania i przechodzi do `feedback`; `next` przechodzi do kolejnego pytania lub do `summary` po ostatnim; `restart` wraca do `setup` i czyści stan. `answers` to lista par (pytanie, wybrany indeks) używana w podsumowaniu.

#### 3. Komponenty sesji

**File**: `src/components/practice/PracticeApp.tsx`, `SetupStep.tsx`, `QuestionStep.tsx`, `SummaryStep.tsx` (nowe)

**Intent**: Czytelny na iPhonie i iPadzie przepływ z informacją zwrotną niezależną od samego koloru.

**Contract**: `SetupStep` — wybór alfabetu i kierunku (dwie grupy dużych przycisków, domyślnie hiragana i znak → zapis łaciński) oraz „Start”. `QuestionStep` — duży prompt (znak lub zapis), numer pytania „n / 10”, siatka 2×2 przycisków o wysokości ≥ 44 px; po odpowiedzi opcje są zablokowane, poprawna jest wyróżniona, błędnie wybrana oznaczona, a pod nimi region `aria-live="polite"` z tekstem „Correct” albo „Incorrect” i poprawną parą (np. `か = ka`) oraz przycisk „Next” („Finish” przy ostatnim pytaniu). Wyróżnienia mają ikonę lub tekst obok koloru. `SummaryStep` — wynik `X/10`, lista błędnie rozpoznanych znaków z poprawnymi zapisami (lub komunikat o bezbłędnej sesji) i przyciski „Practice again” (ta sama konfiguracja) oraz „Change settings”. Klasy łączone przez `cn()`; przyciski przez `components/ui/button.tsx`. Bez dyrektyw `"use client"`.

#### 4. Linki do ćwiczenia

**File**: `src/pages/dashboard.astro`, `src/components/Topbar.astro`

**Intent**: Zalogowany użytkownik ma widoczne wejście do ćwiczenia z obu istniejących ekranów po zalogowaniu.

**Contract**: Dashboard dostaje wyraźny link „Start practice” do `/practice`, a `Topbar` (gałąź zalogowanego użytkownika) link „Practice” obok „Dashboard”. Gałąź dla niezalogowanych bez zmian.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji nadal przechodzą: `npm run check:session`
- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build produkcyjny przechodzi: `npm run build`

#### Manual Verification:

- Pełna sesja przechodzi dla hiragany w kierunku znak → zapis łaciński (10 pytań, wynik na końcu)
- Pełna sesja przechodzi dla katakany w kierunku zapis łaciński → znak
- Błędna odpowiedź jest oznaczona „Incorrect” z poprawną parą i trafia na listę pomyłek w podsumowaniu
- „Practice again” i „Change settings” działają, a nowa sesja losuje inne pytania

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Weryfikacja i domknięcie wycinka

### Overview

Smoke test dla nowej trasy, ręczny przegląd na iPhonie/iPadzie oraz synchronizacja statusu roadmapy.

### Changes Required:

#### 1. Smoke dla /practice

**File**: `scripts/smoke.mjs`

**Intent**: Pilnować w CI, że trasa ćwiczenia jest chroniona i renderuje się dla zalogowanego użytkownika.

**Contract**: Dwa nowe kroki w tablicy `steps`: „practice redirects anonymous user” (`/practice` → 302 `/auth/signin`, umieszczony przed rejestracją) oraz „practice renders for signed-in user” (`/practice` → 200, tuż po kroku „dashboard renders for signed-in user”). Runner bez zmian.

#### 2. Status roadmapy

**File**: `context/foundation/roadmap.md`

**Intent**: Roadmapa odzwierciedla stan wycinka S-01.

**Contract**: Status S-01 jest ustawiany przez cykl życia zmiany (`planning` przy planowaniu, `in-progress` w `/10x-implement`, `done` w `/10x-archive`); ta faza niczego tu nie dopisuje ręcznie poza zgodnością z tym cyklem.

### Success Criteria:

#### Automated Verification:

- Smoke przechodzi na działającym serwerze: `npm run smoke`
- Build produkcyjny przechodzi: `npm run build`
- Linting i typy przechodzą: `npm run lint && npx astro check`

#### Manual Verification:

- Na szerokości iPhone’a (≈390 px) strona `/practice` nie ma poziomego przewijania, a przyciski opcji są wygodne do trafienia kciukiem
- Na szerokości iPada (≈820 px) układ jest czytelny, a znak w pytaniu wyraźnie duży
- Niezalogowany użytkownik wchodzący na `/practice` trafia na `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `scripts/check-session.mjs`: dla obu alfabetów i kierunków oraz wielu losowań — 10 różnych znaków, 4 unikalne opcje na pytanie, poprawna opcja na `correctIndex`, właściwy typ promptu i opcji, brak dystraktora równego poprawnej odpowiedzi; `KANA` ma 46 unikalnych wierszy.

### Integration Tests:

- `scripts/smoke.mjs`: ochrona `/practice` dla anonima i render dla zalogowanego (nie sprawdza interakcji w wyspie React).

### Manual Testing Steps:

1. Zaloguj się, wejdź w „Start practice”, wybierz hiraganę i znak → zapis łaciński, przejdź 10 pytań, w tym co najmniej jedną celowo błędną.
2. Powtórz dla katakany i kierunku zapis łaciński → znak.
3. Sprawdź „Practice again”, „Change settings” oraz odświeżenie strony w trakcie sesji (sesja ginie — oczekiwane do czasu S-02).
4. Powtórz krok 1 na szerokości iPhone’a i iPada (narzędzia deweloperskie lub urządzenie).

## Performance Considerations

Losowanie 10 pytań z 46 znaków jest pomijalne kosztowo i działa w całości po stronie klienta, więc odpowiedź na kliknięcie jest natychmiastowa. Mierzalny cel „płynnej reakcji” pozostaje otwartym pytaniem roadmapy.

## Migration Notes

Nie dotyczy: brak zmian w bazie i w istniejących danych. S-02 doda wysyłanie odpowiedzi na serwer, a kształt `Question` i `answers` został dobrany tak, by wystarczył mu identyfikator znaku (`romaji`), kierunek i alfabet.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01), PRD: `context/foundation/prd.md` (US-01, FR-001–FR-005)
- Wzorzec ochrony tras: `src/middleware.ts:4`
- Wzorzec komponentów React i stylu kart: `src/components/auth/SignInForm.tsx`, `src/pages/dashboard.astro`
- Wzorzec kroków smoke: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dane znaków i logika sesji

#### Automated

- [x] 1.1 Niezmienniki sesji i tabeli znaków przechodzą: `npm run check:session` — d16e000
- [x] 1.2 Linting przechodzi: `npm run lint` — d16e000
- [x] 1.3 Sprawdzenie typów przechodzi: `npx astro check` — d16e000

#### Manual

- [x] 1.4 Tabela `KANA` jest zgodna z tabelą gojūon (46 wierszy, Hepburn, `wo`, `n`) po przeglądzie w pliku — d16e000

### Phase 2: Strona /practice i interfejs sesji

#### Automated

- [x] 2.1 Niezmienniki sesji nadal przechodzą: `npm run check:session` — 4b3afde
- [x] 2.2 Linting przechodzi: `npm run lint` — 4b3afde
- [x] 2.3 Sprawdzenie typów przechodzi: `npx astro check` — 4b3afde
- [x] 2.4 Build produkcyjny przechodzi: `npm run build` — 4b3afde

#### Manual

- [x] 2.5 Pełna sesja przechodzi dla hiragany w kierunku znak → zapis łaciński (10 pytań, wynik na końcu) — 4b3afde
- [x] 2.6 Pełna sesja przechodzi dla katakany w kierunku zapis łaciński → znak — 4b3afde
- [x] 2.7 Błędna odpowiedź jest oznaczona „Incorrect” z poprawną parą i trafia na listę pomyłek w podsumowaniu — 4b3afde
- [x] 2.8 „Practice again” i „Change settings” działają, a nowa sesja losuje inne pytania — 4b3afde

### Phase 3: Weryfikacja i domknięcie wycinka

#### Automated

- [x] 3.1 Smoke przechodzi na działającym serwerze: `npm run smoke` — aa455bd
- [x] 3.2 Build produkcyjny przechodzi: `npm run build` — aa455bd
- [x] 3.3 Linting i typy przechodzą: `npm run lint && npx astro check` — aa455bd

#### Manual

- [x] 3.4 Na szerokości iPhone’a (≈390 px) strona `/practice` nie ma poziomego przewijania, a przyciski opcji są wygodne do trafienia kciukiem — aa455bd
- [x] 3.5 Na szerokości iPada (≈820 px) układ jest czytelny, a znak w pytaniu wyraźnie duży — aa455bd
- [x] 3.6 Niezalogowany użytkownik wchodzący na `/practice` trafia na `/auth/signin` — aa455bd
