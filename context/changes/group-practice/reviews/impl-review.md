<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ćwiczenie w grupach znaków

- **Plan**: context/changes/group-practice/plan.md
- **Scope**: Full plan (3 of 3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Grupa kafelków ma 14 przystanków Tab, bez nawigacji strzałkami

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/practice/SetupStep.tsx:77-101
- **Detail**: `GroupChoice` ma `role="radiogroup"` i `role="radio"` na zwykłych przyciskach, ale bez roving tabindex i obsługi strzałek, więc każdy z 14 kafelków jest osobnym przystankiem Tab (razem 18 z pozostałymi grupami). Czytnik ekranu oczekujący semantyki radio nie dostaje nawigacji strzałkami. Ten sam wzorzec ma istniejący `ChoiceGroup` (2 kafelki), więc jest spójny, ale przy 14 kafelkach koszt rośnie. Podpis romaji ma 11 px przy 80% krycia (niska czytelność, PRD: czytelność na iPhonie i iPadzie), a nazwa dostępna łączy etykietę i znaki („A a i u e o”).
- **Fix A ⭐ Recommended**: Roving tabindex i strzałki w grupie radio, wspólny dla `ChoiceGroup` i `GroupChoice`, oraz podpis romaji `text-xs`
  - Strength: Poprawia semantykę, którą już deklaruje `role="radio"`, i redukuje przystanki Tab z 18 do 3 grup.
  - Tradeoff: Obsługa klawiatury w dwóch komponentach (mały wspólny hook lub helper).
  - Confidence: MEDIUM — wzorzec WAI-ARIA radio group jest standardowy, ale nie testowano z czytnikiem ekranu.
  - Blind spot: Zachowanie na VoiceOver (iPhone/iPad) nie było sprawdzane.
- **Fix B**: Zmienić kafelki na przyciski `aria-pressed` bez `role="radio"`
  - Strength: Najmniej kodu, semantyka przycisków przełączających.
  - Tradeoff: Nie redukuje liczby przystanków Tab i zmienia semantykę istniejącego `ChoiceGroup` albo rozjeżdża go z `GroupChoice`.
  - Confidence: MEDIUM — prostsze, ale nie rozwiązuje problemu 14 przystanków.
  - Blind spot: Brak testu z czytnikiem ekranu.
- **Decision**: PENDING

### F2 — Sąsiednie duplikaty możliwe pod koniec sesji w małej grupie, bez testu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/session.ts:44-51
- **Detail**: W grupach 5- i 6-znakowych limit to 2, więc gdy zostaje tylko jeden znak z wolnymi miejscami, awaryjne dopuszczenie sąsiada daje dwa kolejne pytania o ten sam znak. To zgodne z decyzją planu („w miarę możliwości”), ale `check-session.mjs` sprawdza brak sąsiadów tylko dla Z/D i trybu bez grupy, więc zachowanie dla K nie jest opisane testem.
- **Fix**: Dodać w `check-session.mjs` asercję dokumentującą, że w K sąsiedzi są dozwolone tylko jako ostateczność (np. liczba sesji z sąsiadem poniżej progu), albo zaakceptować i zostawić jak jest.
- **Decision**: PENDING

### F3 — Smoke dla „di” sprawdza tylko statusy HTTP

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:211-226
- **Detail**: Nowe kroki sprawdzają 201 i 200, ale nie to, że odpowiedź „di” faktycznie się zapisała. Test przeszedłby także, gdyby serwer ją zignorował. Brak ryzyka flaky ani kolizji z wcześniejszymi krokami (osobna sesja `total: 1`).
- **Fix**: Dodać krok po zapisie: statystyki użytkownika A zawierają `di` z `answers === 1` (jak istniejący `statOf(body, "ha")`).
- **Decision**: PENDING

### F4 — Kod fazy 3 wszedł do commitu S-06 (`3ec86ca`)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: git 3ec86ca (feat(hot-five-difficult-chars): Wejście z dashboardu i weryfikacja reguły (p2))
- **Detail**: Sesja S-06 zrobiła commit ze wspólnym indeksem i zabrała staged pliki fazy 3 (hook, `SetupStep`, `SummaryStep`, smoke, korekta opcji, plan, brief). Zawartość jest poprawna, ale commit ma temat innej zmiany, a wiersze 3.1–3.10 w Progress wskazują na jego SHA. `src/pages/dashboard.astro` w tym commicie należy do S-06.
- **Fix**: Nie przepisywać historii; przy `/10x-archive` odnotować SHA `3ec86ca` jako zamykający fazę 3 (lub użyć mechanizmu repoint SHA, jeśli potrzebny integracyjny commit).
- **Decision**: PENDING
