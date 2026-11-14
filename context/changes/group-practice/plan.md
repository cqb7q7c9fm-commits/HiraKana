# Ćwiczenie w grupach znaków — Implementation Plan

## Overview

Użytkownik może ograniczyć sesję rozpoznawania do jednej z 13 grup znaków (np. K: ka ki ku ke ko) albo ćwiczyć cały wybrany alfabet. Każdy znak należy do dokładnie jednej grupy, więc powtórka liczy się i do znaku, i do jego grupy także w trybie „Wszystkie” (FR-009, FR-013). To wymaga rozszerzenia tablicy `KANA` do 71 znaków (dakuten i handakuten), nowej logiki sesji z powtórkami w małych grupach oraz wyboru grupy na ekranie ustawień.

## Current State Analysis

Po S-01 i S-02 (obie zarchiwizowane) sesja działa end-to-end: wybór alfabetu i kierunku, 10 pytań, zapis odpowiedzi w tle do Supabase, podsumowanie z bazy i historia `/results`.

- `src/lib/kana.ts` ma 46 znaków podstawowych (bez dakuten/handakuten, bez grup).
- `buildSession` (`src/lib/services/session.ts:18`) losuje 10 unikalnych znaków z całej przekazanej tablicy i rzuca błąd, gdy jest ich mniej niż 10. Grupa 5-znakowa jest więc odrzucana. Błędne opcje losuje z całej przekazanej tablicy.
- `usePracticeSession.start(alphabet, direction)` (`src/components/hooks/usePracticeSession.ts:17`) i `SetupStep` nie znają grupy; `startAgain` powtarza tylko alfabet i kierunek.
- Zapis z S-02 przechowuje `romaji` per odpowiedź (`session_answers.romaji`), a `saveAnswerSchema` buduje `ROMAJI_SET` z `KANA` (`src/lib/services/session-store.ts:6`). Nowe znaki zostaną więc przyjęte bez zmian po stronie serwera, a grupa daje się wyprowadzić z `romaji`, bez nowej kolumny.
- `scripts/check-session.mjs` twardo sprawdza `KANA.length === 46`, „pytania o różne znaki” i błąd dla `KANA.slice(0, 5)`.
- Lista pomyłek (`SummaryStep.tsx`, `results/[id].astro`) pokazuje wpis na każdą błędną odpowiedź, a `SummaryStep` używa `key={romaji}`, co przy powtórkach da zduplikowane klucze.

## Desired End State

Na `/practice` użytkownik wybiera alfabet, kierunek i grupę („Wszystkie” albo jedną z 13). Sesja ma zawsze 10 pytań; w grupie K każdy znak pada dokładnie 2 razy w losowej kolejności. „Practice again” zachowuje grupę. Podsumowanie i `/results/[id]` pokazują każdy pomylony znak raz, a wynik X/10 nadal liczy pytania. W bazie odpowiedzi trafiają jak dotąd, także dla nowych znaków.

Weryfikacja: `npm run check:session` (dane i niezmienniki sesji), lint, `astro check`, build, smoke z odpowiedzią dla znaku dakuten oraz ręczne przejście sesji grupy K i Z/D.

### Key Discoveries:

- `saveAnswerSchema` i filtr romaji są wyprowadzane z `KANA`, więc dodanie znaków nie wymaga migracji ani zmian w API (`src/lib/services/session-store.ts:6`).
- Grupy są wspólne dla obu alfabetów tylko jako podział według romaji; pytania i opcje zawsze pochodzą z jednego wybranego alfabetu.
- Romaji ぢ/づ to „di”/„du” (nie „ji”/„zu”), więc wszystkie wartości `romaji`, `hiragana` i `katakana` pozostają unikalne, a odpowiedzi jednoznaczne w obu kierunkach.
- `buildSession` bierze `entries` jednocześnie jako pulę celów i pulę błędnych opcji (`session.ts:33-40`); grupa musi rozdzielić te role.
- `check-session.mjs` wywołuje `buildSession(KANA, alphabet, direction, random)`; nowy parametr grupy dodajemy na końcu, żeby nie psuć istniejących wywołań.

## What We're NOT Doing

- Zapisu grupy w bazie (kolumna w `practice_sessions`) ani migracji; grupa wynika z `romaji`.
- Statystyk i widoku opanowania grup, siły znajomości (S-05), hot-5 (S-06) oraz ważonych powtórek (S-03).
- Kombinacji (kya, sha, cha …), małego っ i rozszerzonych katakany (poza MVP wg roadmapy).
- Reguły, która rozdzielałaby dwa kolejne pytania o ten sam znak w sesji grupowej (kolejność jest losowa).
- Wyświetlania grupy na `/results` ani filtrowania historii po grupie.
- Nowych zależności testowych (zostajemy przy `check-session.mjs` i `smoke.mjs`).

## Implementation Approach

Trzy fazy od danych do UI. Najpierw dane i grupy z niezmiennikami (każdy znak w dokładnie jednej grupie), potem czysta logika `buildSession` z grupą i powtórkami, objęta `check-session`, na końcu hook i UI. Błędne opcje zawsze pochodzą z całego wybranego alfabetu (71 znaków), a poprawna odpowiedź z grupy. Reguła powtórek: grupa o `n < 10` znakach dostaje po `floor(10/n)` pytań na znak, a resztę do 10 losuje się spośród znaków grupy (każdy znak pada `floor` albo `floor+1` razy); grupa o `n ≥ 10` znakach daje 10 różnych znaków. Dla grup z roadmapy znak pada najwyżej 2 razy (limit z roadmapy: 3).

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

`buildSession` buduje sesję 10 pytań dla jednej grupy albo dla całego alfabetu, z równymi powtórkami w małych grupach.

### Changes Required:

#### 1. Budowanie sesji z grupą

**File**: `src/lib/services/session.ts`

**Intent**: Dodać opcjonalny filtr grupy: cele pytań pochodzą z grupy (lub z całej tablicy, gdy grupy nie podano), a 3 błędne opcje zawsze z całej tablicy `entries` dla wybranego alfabetu. Dla `n < 10` celów rozłożyć 10 pytań równo wg reguły z „Implementation Approach”, dla `n ≥ 10` wziąć 10 różnych znaków; całość wymieszać losowo. Błąd dla nieznanej lub pustej grupy oraz dla puli mniejszej niż liczba opcji.

**Contract**: `buildSession(entries, alphabet, direction, random = Math.random, group: string | null = null): Question[]`. Zwraca zawsze `SESSION_LENGTH` pytań. Niezmienniki: dla celu `n < 10` liczba pytań o jeden znak to `floor(10/n)` albo `floor(10/n)+1`; wszystkie cele należą do grupy; opcje są unikalne, mają `OPTION_COUNT` elementów, zawierają poprawną odpowiedź i pochodzą z puli wybranego alfabetu i kierunku. Minimalna pula `entries` to `OPTION_COUNT`, a nie `SESSION_LENGTH`.

#### 2. Niezmienniki sesji

**File**: `scripts/check-session.mjs`

**Intent**: Rozszerzyć kontrolę sesji o każdą z 13 grup w 4 trybach (2 alfabety × 2 kierunki), z deterministycznym i losowym źródłem liczb. Zastąpić warunek „pytania o różne znaki” regułą zależną od rozmiaru celu i dodać przypadki brzegowe.

**Contract**: Sprawdzane: długość 10; wszystkie cele z grupy; liczba wystąpień znaku zgodna z regułą powtórek (np. K: dokładnie 2 każdy; Y/W/N: 1 lub 2; Z/D: 10 różnych); opcje z całego alfabetu; błąd dla nieznanej grupy i dla puli mniejszej niż 4; tryb bez grupy nadal daje 10 różnych znaków z 71.

### Success Criteria:

#### Automated Verification:

- Niezmienniki sesji dla 13 grup i trybu „Wszystkie” przechodzą: `npm run check:session`
- Sprawdzenie typów przechodzi: `npx astro check`
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- Czytelność zmian: po przejrzeniu `buildSession` reguła powtórek i rola puli opcji są zrozumiałe bez czytania testów

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 3: UI i hook

### Overview

Wybór grupy na ekranie ustawień, przekazanie jej przez hook oraz poprawka listy pomyłek dla powtórzonych znaków.

### Changes Required:

#### 1. Hook sesji

**File**: `src/components/hooks/usePracticeSession.ts`

**Intent**: Przechowywać wybraną grupę w stanie, przekazywać ją do `buildSession` i zachować w „Practice again”. Zapis odpowiedzi z S-02 pozostaje bez zmian (`sync.begin`, `enqueue`).

**Contract**: `start(alphabet, direction, group: string | null)`, nowe pole `group` w zwracanym obiekcie; `startAgain` używa bieżącej grupy; `restart` wraca do ustawień, nie kasując ostatniego wyboru.

#### 2. Ekran ustawień

**File**: `src/components/practice/SetupStep.tsx`, `src/components/practice/PracticeApp.tsx`

**Intent**: Dodać trzecią grupę wyboru w stylu istniejącego `ChoiceGroup`: kafelki „Wszystkie” + 13 grup (etykieta grupy i jej znaki w zapisie łacińskim, np. „K · ka ki ku ke ko”). Układ zwarty na wąskim ekranie (iPhone), kafelki o wysokości co najmniej 44 px, `role="radiogroup"` i stan `aria-checked` jak w pozostałych grupach.

**Contract**: `SetupStep` przyjmuje `initialGroup` i wywołuje `onStart(alphabet, direction, group)`; `PracticeApp` przekazuje `session.group`. Wartość „Wszystkie” to `null`.

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

- Na `/practice` wybór grupy K daje 10 pytań, każdy z pięciu znaków dokładnie 2 razy, a opcje zawierają znaki spoza grupy
- Grupa Z/D daje 10 różnych znaków, a ぢ/づ pytają i odpowiadają „di”/„du” w obu kierunkach
- „Practice again” zachowuje grupę, „Change settings” wraca do ekranu z zachowanym wyborem
- Znak pomylony dwa razy pojawia się na liście „Characters to review” jeden raz, a wynik X/10 liczy oba błędy
- Siatka grup jest czytelna i wygodna do dotyku na iPhonie i iPadzie
- W Supabase Studio odpowiedzi z sesji grupy K mają `romaji` z grupy K

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `scripts/check-session.mjs` (zero zależności): dane (71 wierszy, 13 grup, każdy znak w jednej grupie) i niezmienniki `buildSession` dla każdej grupy, 4 trybów i dwóch źródeł losowości.
- Przypadki brzegowe: grupa 5-, 6- i 10-znakowa, nieznana grupa, za mała pula.

### Integration Tests:

- `scripts/smoke.mjs`: zapis odpowiedzi „di” przez API z S-02 (RLS i izolacja bez zmian).

### Manual Testing Steps:

1. Sesja grupy K w kierunku kana → romaji: policz wystąpienia znaków (po 2) i sprawdź opcje.
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
- Sesja: `src/lib/services/session.ts:18`, `src/components/hooks/usePracticeSession.ts:17`
- Walidacja romaji: `src/lib/services/session-store.ts:6`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dane znaków i grupy

#### Automated

- [x] 1.1 Niezmienniki danych i sesji przechodzą: `npm run check:session`
- [x] 1.2 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 1.3 Linting przechodzi: `npm run lint`

#### Manual

- [x] 1.4 Przegląd tablicy: hiragana i katakana dla ga/gi/gu/ge/go, za/ji/zu/ze/zo/da/di/du/de/do, ba…bo, pa…po są poprawne, a ぢ/づ (ヂ/ヅ) mają romaji „di”/„du”

### Phase 2: Logika sesji z grupą

#### Automated

- [ ] 2.1 Niezmienniki sesji dla 13 grup i trybu „Wszystkie” przechodzą: `npm run check:session`
- [ ] 2.2 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 2.3 Linting przechodzi: `npm run lint`

#### Manual

- [ ] 2.4 Czytelność zmian: po przejrzeniu `buildSession` reguła powtórek i rola puli opcji są zrozumiałe bez czytania testów

### Phase 3: UI i hook

#### Automated

- [ ] 3.1 Niezmienniki sesji nadal przechodzą: `npm run check:session`
- [ ] 3.2 Linting i typy przechodzą: `npm run lint && npx astro check`
- [ ] 3.3 Build produkcyjny przechodzi: `npm run build`
- [ ] 3.4 Smoke z odpowiedzią „di” przechodzi na działającym serwerze z lokalnym Supabase: `npm run smoke`

#### Manual

- [ ] 3.5 Na `/practice` wybór grupy K daje 10 pytań, każdy z pięciu znaków dokładnie 2 razy, a opcje zawierają znaki spoza grupy
- [ ] 3.6 Grupa Z/D daje 10 różnych znaków, a ぢ/づ pytają i odpowiadają „di”/„du” w obu kierunkach
- [ ] 3.7 „Practice again” zachowuje grupę, „Change settings” wraca do ekranu z zachowanym wyborem
- [ ] 3.8 Znak pomylony dwa razy pojawia się na liście „Characters to review” jeden raz, a wynik X/10 liczy oba błędy
- [ ] 3.9 Siatka grup jest czytelna i wygodna do dotyku na iPhonie i iPadzie
- [ ] 3.10 W Supabase Studio odpowiedzi z sesji grupy K mają `romaji` z grupy K
