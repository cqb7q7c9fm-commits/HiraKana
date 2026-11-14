# Ćwiczenie w grupach znaków — Implementation Plan

## Overview

Użytkownik może ograniczyć sesję rozpoznawania do jednej z 13 grup znaków (np. K: ka ki ku ke ko) albo ćwiczyć cały wybrany alfabet. Każdy znak należy do dokładnie jednej grupy, więc powtórka liczy się i do znaku, i do jego grupy także w trybie „Wszystkie” (FR-009, FR-013). To wymaga rozszerzenia tablicy `KANA` do 71 znaków (dakuten i handakuten), nowej logiki sesji z powtórkami w małych grupach oraz wyboru grupy na ekranie ustawień.

## Current State Analysis

Po S-01, S-02 i S-03 (wszystkie zarchiwizowane) sesja działa end-to-end: wybór alfabetu i kierunku, 10 pytań ważonych błędami, zapis odpowiedzi w tle do Supabase, podsumowanie z bazy i historia `/results`. Faza 1 tego planu jest zatwierdzona (`817f070`): `KANA` ma 71 znaków z polem `group`, jest `KANA_GROUPS` i niezmienniki danych w `check-session.mjs`.

- `buildSession` (`src/lib/services/session.ts`) po S-03 przyjmuje `(entries, alphabet, direction, random, stats)` i losuje cele przez `pickTargets`: ważone błędami z ostatnich 5 odpowiedzi (`weightOf`: 1 + 3 × odsetek błędów), limit powtórzeń w sesji 3 (`MAX_REPEATS`) dla znaku z błędami i 1 dla pozostałych, bez sąsiednich duplikatów. Gdy losowanie nie ma z czego wybrać, rzuca „could not select enough questions”. Grupa 5-znakowa z limitem 1 dałaby najwyżej 5 pytań, więc dziś rzuciłaby ten błąd. Pula błędnych opcji to całe `entries`, a minimalna pula to `max(SESSION_LENGTH, OPTION_COUNT)`.
- `usePracticeSession.start(alphabet, direction)` jest asynchroniczny: pobiera statystyki (`fetchCharStats`, timeout, fallback na pustą mapę), ma flagę `starting` i ochronę przed podwójnym startem; `SetupStep` i `startAgain` nie znają grupy.
- Zapis z S-02 przechowuje `romaji` per odpowiedź (`session_answers.romaji`), a `saveAnswerSchema` buduje `ROMAJI_SET` z `KANA` (`src/lib/services/session-store.ts:6`). Nowe znaki zostaną więc przyjęte bez zmian po stronie serwera, a grupa daje się wyprowadzić z `romaji`, bez nowej kolumny. Endpoint statystyk zwraca jeden wiersz na `romaji`, więc obejmuje też nowe znaki.
- `scripts/check-session.mjs` ma już niezmienniki danych z fazy 1 oraz niezmienniki S-03 dla trybu bez grupy (wagi, limity 3/1, brak sąsiednich duplikatów, „różne znaki”). Sprawdza też błąd dla `KANA.slice(0, 5)`, co po zmianie minimalnej puli przestanie rzucać.
- Lista pomyłek (`SummaryStep.tsx`, `results/[id].astro`) pokazuje wpis na każdą błędną odpowiedź, a `SummaryStep` używa `key={romaji}`, co przy powtórkach da zduplikowane klucze.

## Desired End State

Na `/practice` użytkownik wybiera alfabet, kierunek i grupę („Wszystkie” albo jedną z 13). Sesja ma zawsze 10 pytań; w grupie K bez historii błędów każdy znak pada dokładnie 2 razy w losowej kolejności, a znaki z błędami (statystyka S-03) padają częściej, do 3 razy. „Practice again” zachowuje grupę. Podsumowanie i `/results/[id]` pokazują każdy pomylony znak raz, a wynik X/10 nadal liczy pytania. W bazie odpowiedzi trafiają jak dotąd, także dla nowych znaków.

Weryfikacja: `npm run check:session` (dane i niezmienniki sesji), lint, `astro check`, build, smoke z odpowiedzią dla znaku dakuten oraz ręczne przejście sesji grupy K i Z/D.

### Key Discoveries:

- `saveAnswerSchema` i filtr romaji są wyprowadzane z `KANA`, więc dodanie znaków nie wymaga migracji ani zmian w API (`src/lib/services/session-store.ts:6`).
- Grupy są wspólne dla obu alfabetów tylko jako podział według romaji; pytania i opcje zawsze pochodzą z jednego wybranego alfabetu.
- Romaji ぢ/づ to „di”/„du” (nie „ji”/„zu”), więc wszystkie wartości `romaji`, `hiragana` i `katakana` pozostają unikalne, a odpowiedzi jednoznaczne w obu kierunkach.
- `buildSession` bierze `entries` jednocześnie jako pulę celów i pulę błędnych opcji; w sesji grupowej obie pule zawęża do grupy (po teście ręcznym: opcje spoza grupy zdradzały odpowiedź).
- Limit „1 powtórzenie” dla znaku bez błędów z S-03 uniemożliwia 10 pytań z grupy mniejszej niż 10 znaków; limit musi zależeć od rozmiaru puli celów (`ceil(10/n)`), co dla pełnego alfabetu (n = 71) i grupy Z/D (n = 10) daje te same 1.
- Zakaz sąsiednich duplikatów z S-03 może utknąć w małej grupie (zostaje tylko znak, który padł przed chwilą), więc w trybie grupowym obowiązuje „w miarę możliwości” z awaryjnym dopuszczeniem sąsiada.
- `check-session.mjs` i hook wywołują `buildSession(entries, alphabet, direction, random, stats)`; parametr grupy dodajemy jako 6., żeby nie psuć istniejących wywołań.

## What We're NOT Doing

- Zapisu grupy w bazie (kolumna w `practice_sessions`) ani migracji; grupa wynika z `romaji`.
- Statystyk i widoku opanowania grup, siły znajomości (S-05) oraz hot-5 (S-06). Ważenie błędami (S-03) już istnieje; tu tylko je stosujemy w sesji grupowej.
- Zmiany reguły wag ani limitu 3 powtórzeń z S-03.
- Kombinacji (kya, sha, cha …), małego っ i rozszerzonych katakany (poza MVP wg roadmapy).
- Bezwzględnej gwarancji braku dwóch kolejnych pytań o ten sam znak w sesji grupowej (tylko „w miarę możliwości”).
- Wyświetlania grupy na `/results` ani filtrowania historii po grupie.
- Nowych zależności testowych (zostajemy przy `check-session.mjs` i `smoke.mjs`).

## Implementation Approach

Trzy fazy od danych do UI. Najpierw dane i grupy z niezmiennikami (każdy znak w dokładnie jednej grupie; zrobione), potem czysta logika `buildSession` z grupą, objęta `check-session`, na końcu hook i UI. Błędne opcje w sesji grupowej pochodzą z tej samej grupy (każda ma ≥ 5 znaków, więc mieści 4 opcje), a w trybie „Wszystkie” z całego wybranego alfabetu (71 znaków).

Jedna reguła losowania dla trybu „Wszystkie” i grup: `pickTargets` z S-03 losuje 10 celów z puli celów (grupa albo cały alfabet) z tymi samymi wagami błędów. Limit powtórzeń w sesji dla znaku z błędami zostaje `MAX_REPEATS` (3), a dla znaku bez błędów to `ceil(10/n)`, gdzie `n` to liczba znaków w puli celów (71 → 1, Z/D → 1, K → 2, Y/W/N → 2). Suma limitów zawsze pokrywa 10 pytań. Skutek dla grup bez historii błędów: 5-znakowa grupa (np. K) daje każdy znak dokładnie 2 razy, Z/D daje 10 różnych znaków, a Y/W/N po 1–2 razy (jeden znak może w danej sesji nie paść). Z historią błędów znak z błędami pada częściej, do 3 razy. Sąsiednie duplikaty są wykluczane, a gdy losowanie by utknęło, dopuszczany jest sąsiad jako ostateczność.

## Faza 1: Dane znaków i grupy

### Overview

Rozszerzenie `KANA` o 25 znaków i wprowadzenie 13 zatwierdzonych grup z jednoznacznym przypisaniem każdego znaku.

### Changes Required:

#### 1. Tablica znaków i definicje grup

**File**: `src/lib/kana.ts`, `src/types.ts`

**Intent**: Dodać znaki G (ga gi gu ge go), Z/D (za ji zu ze zo da de do di du), B i P w obu alfabetach oraz przypisać każdy z 71 znaków do jednej z 13 grup z roadmapy (S-04, Decisions). Udostępnić listę grup (id, etykieta, członkowie) i sposób odczytania grupy znaku.

**Contract**: `KanaEntry` dostaje pole `group` (id grupy). `kana.ts` eksportuje `KANA` (71 wpisów) oraz `KANA_GROUPS` (13 pozycji: id, etykieta typu „K”, „Y/W/N”, „Z/D”, kolejność jak w roadmapie). Romaji ぢ/づ to `di`/`du`, a `ji`/`zu` należą do じ/ず. Rozmiary grup: 5,5,5,5,5,5,5,5,6,5,10,5,5 (suma 71).

#### 2. Niezmienniki danych

**File**: `scripts/check-session.mjs`

**Intent**: Zastąpić twardy warunek „46 wierszy” kontrolami zgodnymi z nowym modelem: 71 wierszy, unikalne `romaji`/`hiragana`/`katakana`, dokładnie 13 grup, każdy znak w dokładnie jednej grupie, a każda grupa ma co najmniej 5 znaków.

**Contract**: Skrypt kończy się kodem 1 przy naruszeniu któregokolwiek niezmiennika; logika sesji sprawdzana w tej fazie pozostaje jak dotąd (tryb bez grupy, 10 różnych znaków).

### Success Criteria:

#### Automated Verification:

- Niezmienniki danych i sesji przechodzą: `npm run check:session`
- Sprawdzenie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- Przegląd tablicy: hiragana i katakana dla ga/gi/gu/ge/go, za/ji/zu/ze/zo/da/di/du/de/do, ba…bo, pa…po są poprawne, a ぢ/づ (ヂ/ヅ) mają romaji „di”/„du”

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 2: Logika sesji z grupą

### Overview

`buildSession` buduje sesję 10 pytań dla jednej grupy albo dla całego alfabetu na bazie istniejącego losowania z S-03 (`pickTargets`), z limitem powtórzeń zależnym od rozmiaru puli celów.

*Korekta (test ręczny fazy 3, 2026-11-14): błędne opcje w sesji grupowej pochodzą z grupy, a nie z całego alfabetu; zmiana wprowadzona razem z fazą 3.*

*Uwaga (przeplanowanie po S-03, 2026-11-14): pierwotny opis tej fazy zakładał kod sprzed S-03 (losowanie `shuffle().slice()`, `group` jako 5. parametr). Zakres poniżej zastępuje go; tytuły i kryteria w sekcji Progress pozostają bez zmian.*

### Changes Required:

#### 1. Budowanie sesji z grupą

**File**: `src/lib/services/session.ts`

**Intent**: Dodać opcjonalny filtr grupy i uogólnić `pickTargets`. Pulą celów jest grupa (po `entry.group`) albo całe `entries`, gdy grupy nie podano; 3 błędne opcje pochodzą z tej samej puli (grupa albo całe `entries`). Wagi błędów i `MAX_REPEATS` dla znaku z błędami zostają jak w S-03, a limit dla znaku bez błędów zależy od rozmiaru puli celów: `ceil(SESSION_LENGTH / n)`. Zakaz sąsiednich duplikatów działa w miarę możliwości: gdy po wykluczeniu poprzedniego celu nie ma z czego wybrać, wybór powtarza się bez wykluczenia. Błąd dla nieznanej lub pustej grupy oraz dla puli mniejszej niż `OPTION_COUNT`; minimalna pula `entries` przestaje wymagać `SESSION_LENGTH`.

**Contract**: `buildSession(entries, alphabet, direction, random = Math.random, stats = new Map(), group: string | null = null): Question[]`. Zwraca zawsze `SESSION_LENGTH` pytań. Niezmienniki: wszystkie cele należą do grupy (lub do `entries`); znak bez błędów pada najwyżej `ceil(10/n)` razy, znak z błędami najwyżej `MAX_REPEATS`; bez grupy i bez statystyk 10 różnych znaków (jak dziś); grupa 5-znakowa bez statystyk daje każdy znak dokładnie 2 razy; Z/D daje 10 różnych znaków; opcje są unikalne, mają `OPTION_COUNT` elementów, zawierają poprawną odpowiedź i pochodzą z puli celów (grupa albo cały alfabet) w wybranym alfabecie i kierunku. Wywołania bez 6. parametru działają jak dotąd.

#### 2. Niezmienniki sesji

**File**: `scripts/check-session.mjs`

**Intent**: Zachować niezmienniki S-03 dla trybu bez grupy i dodać kontrolę każdej z 13 grup w 4 trybach (2 alfabety × 2 kierunki), z deterministycznym i losowym źródłem liczb, bez statystyk i ze statystykami błędów. Zmienić sprawdzenie „za mało wpisów” tak, aby dotyczyło puli mniejszej niż `OPTION_COUNT` (np. `KANA.slice(0, 3)`).

**Contract**: Sprawdzane dla grup: długość 10; wszystkie cele z grupy; limity powtórzeń (`ceil(10/n)` bez błędów, `MAX_REPEATS` z błędami); K bez statystyk: dokładnie 2 razy każdy znak; Z/D bez statystyk: 10 różnych; znak z błędami pada średnio częściej niż bez błędów; sąsiednie duplikaty nie występują w grupach, w których da się ich uniknąć (Z/D, a dla K tylko test, że sesja zawsze powstaje bez błędu „could not select”); opcje z grupy (w trybie bez grupy z całego alfabetu); błąd dla nieznanej grupy i dla puli mniejszej niż 4; tryb bez grupy nadal daje 10 różnych znaków z 71 i nie ma sąsiednich duplikatów.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji dla 13 grup i trybu „Wszystkie” przechodzą: `npm run check:session`
- Sprawdzenie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- Czytelność zmian: po przejrzeniu `buildSession` reguła powtórek (limit `ceil(10/n)`, wagi, awaryjny sąsiad) i rola puli opcji są zrozumiałe bez czytania testów

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 3: UI i hook

### Overview

Wybór grupy na ekranie ustawień, przekazanie jej przez hook oraz poprawka listy pomyłek dla powtórzonych znaków.

### Changes Required:

#### 1. Hook sesji

**File**: `src/components/hooks/usePracticeSession.ts`

**Intent**: Przechowywać wybraną grupę w stanie, przekazywać ją do `buildSession` (wraz z pobranymi statystykami) i zachować w „Practice again”. Zapis odpowiedzi z S-02 oraz pobieranie statystyk z S-03 (`fetchCharStats`, `starting`, ochrona przed podwójnym startem) pozostają bez zmian.

**Contract**: `start(alphabet, direction, group: string | null): Promise<void>` wywołuje `buildSession(KANA, alphabet, direction, Math.random, stats, group)`; nowe pole `group` w zwracanym obiekcie; `startAgain` używa bieżącej grupy; `restart` wraca do ustawień, nie kasując ostatniego wyboru.

#### 2. Ekran ustawień

**File**: `src/components/practice/SetupStep.tsx`, `src/components/practice/PracticeApp.tsx`

**Intent**: Dodać trzecią grupę wyboru w stylu istniejącego `ChoiceGroup`: kafelki „Wszystkie” + 13 grup (etykieta grupy i jej znaki w zapisie łacińskim, np. „K · ka ki ku ke ko”). Układ zwarty na wąskim ekranie (iPhone), kafelki o wysokości co najmniej 44 px, `role="radiogroup"` i stan `aria-checked` jak w pozostałych grupach.

**Contract**: `SetupStep` przyjmuje `initialGroup` (obok istniejącego `starting`) i wywołuje `onStart(alphabet, direction, group)`; `PracticeApp` przekazuje `session.group`. Wartość „Wszystkie” to `null`.

#### 3. Lista pomyłek bez duplikatów

**File**: `src/components/practice/SummaryStep.tsx`, `src/pages/results/[id].astro`, `src/lib/services/session.ts`

**Intent**: Pokazywać każdy pomylony znak raz (w kolejności pierwszej pomyłki), zarówno z wyniku z bazy, jak i z lokalnych odpowiedzi; wynik X/Y bez zmian. Usunąć zduplikowane klucze React.

**Contract**: Mała czysta funkcja (np. `uniqueRomaji`) w `session.ts`, używana przez oba widoki; `key` listy oparty na unikalnym `romaji`.

#### 4. Smoke dla nowych znaków

**File**: `scripts/smoke.mjs`

**Intent**: Dodać zapis odpowiedzi dla znaku z dakuten (np. romaji „di”) i sprawdzić, że API go przyjmuje, tak aby przepływ zapisu z S-02 był pokryty dla nowych znaków.

**Contract**: Istniejące asercje zostają; jedna nowa odpowiedź z `romaji: "di"` kończy się statusem sukcesu.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji nadal przechodzą: `npm run check:session`
- Linting i typy przechodzą: `npm run lint && npx astro check`
- Build produkcyjny przechodzi: `npm run build`
- Smoke z odpowiedzią „di” przechodzi na działającym serwerze z lokalnym Supabase: `npm run smoke`

#### Manual Verification:

- Na `/practice` wybór grupy K daje 10 pytań, każdy z pięciu znaków dokładnie 2 razy, a wszystkie 4 opcje pochodzą z grupy K, nie ze znaków spoza niej (korekta po teście ręcznym; tytuł wiersza 3.5 w Progress zachowany bez zmian) (dotyczy konta bez historii błędów w grupie K; ze statystyką błędów znak z błędami pada do 3 razy, a pozostałe po 1–2, zgodnie z regułą S-03)
- Grupa Z/D daje 10 różnych znaków, a ぢ/づ pytają i odpowiadają „di”/„du” w obu kierunkach
- „Practice again” zachowuje grupę, „Change settings” wraca do ekranu z zachowanym wyborem
- Znak pomylony dwa razy pojawia się na liście „Characters to review” jeden raz, a wynik X/10 liczy oba błędy
- Siatka grup jest czytelna i wygodna do dotyku na iPhonie i iPadzie
- W Supabase Studio odpowiedzi z sesji grupy K mają `romaji` z grupy K

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `scripts/check-session.mjs` (zero zależności): dane (71 wierszy, 13 grup, każdy znak w jednej grupie) i niezmienniki `buildSession` dla każdej grupy, 4 trybów i dwóch źródeł losowości, bez statystyk i ze statystykami błędów (wagi, limity 3 i `ceil(10/n)`).
- Przypadki brzegowe: grupa 5-, 6- i 10-znakowa, nieznana grupa, za mała pula, sesja grupy K zawsze powstaje (brak błędu „could not select”), wszystkie znaki w grupie z błędami.

### Integration Tests:

- `scripts/smoke.mjs`: zapis odpowiedzi „di” przez API z S-02 (RLS i izolacja bez zmian).

### Manual Testing Steps:

1. Sesja grupy K w kierunku kana → romaji (konto bez historii błędów w K): policz wystąpienia znaków (po 2) i sprawdź opcje.
2. Sesja grupy Z/D w katakanie, romaji → kana: pytanie „di” ma odpowiedź ヂ, a „du” ヅ.
3. Pomyl ten sam znak dwa razy w grupie K i sprawdź listę pomyłek oraz wynik.
4. „Practice again” i „Change settings” po sesji grupowej.
5. Przejście przez ekran ustawień na telefonie i tablecie.

## Performance Considerations

Brak istotnych: sesja liczy 10 pytań z puli 71 znaków w pamięci przeglądarki, bez zapytań do bazy poza istniejącym zapisem z S-02.

## Migration Notes

Brak migracji bazy. Istniejące odpowiedzi z S-02 zawierają tylko znaki podstawowe i pozostają poprawne; nowe romaji (ga, di, pa …) są akceptowane, bo `ROMAJI_SET` wynika z `KANA`. Nowy `KANA` zmienia pulę trybu „Wszystkie” z 46 na 71 znaków (decyzja z wywiadu).

## References

- Roadmap: `context/foundation/roadmap.md` (S-04, Decisions: 13 grup, ぢ/づ jako „di”/„du”)
- Archiwalny plan zapisu wyników: `context/archive/2026-11-14-save-session-results/plan.md`
- Archiwalny plan ważonych powtórek (S-03): `context/archive/2026-11-14-error-weighted-repeats/plan.md`
- Sesja: `src/lib/services/session.ts` (`pickTargets`, `buildSession`), `src/components/hooks/usePracticeSession.ts` (`start`), `src/components/hooks/charStats.ts`
- Walidacja romaji: `src/lib/services/session-store.ts:6`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dane znaków i grupy

#### Automated

- [x] 1.1 Niezmienniki danych i sesji przechodzą: `npm run check:session` — 817f070
- [x] 1.2 Sprawdzenie typów przechodzi: `npx astro check` — 817f070
- [x] 1.3 Linting przechodzi: `npm run lint` — 817f070

#### Manual

- [x] 1.4 Przegląd tablicy: hiragana i katakana dla ga/gi/gu/ge/go, za/ji/zu/ze/zo/da/di/du/de/do, ba…bo, pa…po są poprawne, a ぢ/づ (ヂ/ヅ) mają romaji „di”/„du” — 817f070

### Phase 2: Logika sesji z grupą

#### Automated

- [x] 2.1 Niezmienniki sesji dla 13 grup i trybu „Wszystkie” przechodzą: `npm run check:session` — 0fcda92
- [x] 2.2 Sprawdzenie typów przechodzi: `npx astro check` — 0fcda92
- [x] 2.3 Linting przechodzi: `npm run lint` — 0fcda92

#### Manual

- [x] 2.4 Czytelność zmian: po przejrzeniu `buildSession` reguła powtórek i rola puli opcji są zrozumiałe bez czytania testów — 0fcda92

### Phase 3: UI i hook

#### Automated

- [x] 3.1 Niezmienniki sesji nadal przechodzą: `npm run check:session` — 3ec86ca
- [x] 3.2 Linting i typy przechodzą: `npm run lint && npx astro check` — 3ec86ca
- [x] 3.3 Build produkcyjny przechodzi: `npm run build` — 3ec86ca
- [x] 3.4 Smoke z odpowiedzią „di” przechodzi na działającym serwerze z lokalnym Supabase: `npm run smoke` — 3ec86ca

#### Manual

- [x] 3.5 Na `/practice` wybór grupy K daje 10 pytań, każdy z pięciu znaków dokładnie 2 razy, a opcje zawierają znaki spoza grupy — 3ec86ca
- [x] 3.6 Grupa Z/D daje 10 różnych znaków, a ぢ/づ pytają i odpowiadają „di”/„du” w obu kierunkach — 3ec86ca
- [x] 3.7 „Practice again” zachowuje grupę, „Change settings” wraca do ekranu z zachowanym wyborem — 3ec86ca
- [x] 3.8 Znak pomylony dwa razy pojawia się na liście „Characters to review” jeden raz, a wynik X/10 liczy oba błędy — 3ec86ca
- [x] 3.9 Siatka grup jest czytelna i wygodna do dotyku na iPhonie i iPadzie — 3ec86ca
- [x] 3.10 W Supabase Studio odpowiedzi z sesji grupy K mają `romaji` z grupy K — 3ec86ca
