---
project: HiraKana
version: 1
status: draft
created: 2026-11-07
updated: 2026-11-07
prd_version: 1
main_goal: low-complexity
top_blocker: time
milestone_id: first-usable-recognition-trainer
milestone_seq: 1
milestone_status: open
---

# Roadmap: HiraKana

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Pierwszy używalny trener rozpoznawania znaków** — Status: open

- **Intent:** Użytkownik może zalogować się e-mailem, przećwiczyć znaki hiragany i katakany w sesjach rozpoznawania (oba kierunki), a aplikacja zapamiętuje jego błędy, częściej je powtarza i pokazuje postęp per grupa.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001 do FR-007, FR-009 do FR-013, US-01 (wszystkie wymagania must-have z PRD).

## Vision recap

Użytkownikowi trudno zapamiętać znaki hiragany i katakany, a brak ich znajomości utrudnia naukę języka i zniechęca. Aplikacja ma być „lekką” alternatywą dla rozbudowanych kursów: uczy zapamiętania par znak japoński ↔ zapis łaciński przez wybór właściwej odpowiedzi spośród 4, a znaki, w których użytkownik się myli, wracają częściej. Ścieżka pisania (rysowanie) jest poza tym kamieniem milowym.

## North star

**S-01: Użytkownik może zalogować się e-mailem i przejść sesję rozpoznawania znaków z informacją zwrotną** — to pierwszy wycinek, który udowadnia, że produkt działa, i jednocześnie najmniejszy kompletny przepływ, co pasuje do celu niskiej złożoności.

> „Gwiazda przewodnia” to najmniejszy kompletny przepływ, którego udane dostarczenie udowadnia główną hipotezę produktu; stawiamy go tak wcześnie, jak pozwalają zależności, bo reszta ma sens tylko wtedy, gdy on działa.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                        | Prerequisites | PRD refs                                  | Status   |
| ---- | --------------------------- | --------------------------------------------------------------------------- | ------------- | ----------------------------------------- | -------- |
| F-01 | ci-on-main-branch           | (foundation) kontrola jakości i wdrożenie uruchamiają się na gałęzi `main`  | —             | Guardrails                                | in-progress |
| S-01 | recognition-session-basic   | zalogować się e-mailem i przejść sesję rozpoznawania z informacją zwrotną   | F-01          | US-01, FR-001, FR-002, FR-003, FR-004, FR-005 | proposed |
| S-02 | save-session-results        | zobaczyć zapisany wynik sesji, z odpowiedziami przypisanymi do znaków       | S-01          | US-01, FR-007, FR-013                     | proposed |
| S-03 | error-weighted-repeats      | dostawać błędne znaki częściej niż opanowane                                | S-02          | FR-006                                    | proposed |
| S-04 | group-practice              | ćwiczyć znaki w grupach (np. grupa K)                                       | S-01          | FR-009, FR-013                            | blocked  |
| S-05 | group-mastery-view          | zobaczyć opanowanie grup i siłę znajomości w 3-stopniowej skali             | S-02, S-04    | FR-010, FR-011                            | blocked  |
| S-06 | hot-five-difficult-chars    | zobaczyć „hot-5” — 5 najtrudniejszych znaków                                | S-02          | FR-012                                    | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                 | Chain                                   | Note                                                                                  |
| ------ | --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| A      | Sesja i zapis         | `F-01` → `S-01` → `S-02` → `S-03`       | Najkrótsza ścieżka do działającej nauki z powtórkami błędów (niska złożoność).         |
| B      | Grupy i postęp        | `S-04` → `S-05`                         | Joins Stream A at `S-01` (S-04) and `S-02` (S-05); zablokowany do rozstrzygnięcia grup. |
| C      | Najtrudniejsze znaki  | `S-06`                                  | Joins Stream A at `S-02`; mała, niezależna od grup.                                   |

## Baseline

What's already in place in the codebase as of `2026-11-07` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + Tailwind, strony logowania i rejestracji, layout, strona `dashboard`.
- **Backend / API:** partial — tylko trasy uwierzytelniania; brak tras aplikacji (sesje, odpowiedzi).
- **Data:** absent — konfiguracja bazy istnieje, ale bez migracji i tabel.
- **Auth:** present — logowanie e-mailem i hasłem z ochroną strony `dashboard`; konta zewnętrzne (Apple/Google) nie istnieją i są nice-to-have (FR-015, zob. Parked).
- **Deploy / infra:** partial — konfiguracja wdrożenia i CI istnieją, ale CI nasłuchuje gałęzi `master`, a repozytorium używa `main`.
- **Observability:** partial — włączona tylko flaga w konfiguracji wdrożenia; brak śledzenia błędów.

## Foundations

### F-01: Kontrola jakości i wdrożenie na gałęzi `main`

- **Outcome:** (foundation) przepływ CI (lint, sprawdzenie typów, build, smoke) uruchamia się dla gałęzi `main` i pull requestów do niej.
- **Change ID:** ci-on-main-branch
- **PRD refs:** Guardrails (wyniki nie giną, czytelność na iPhonie i iPadzie — wymagają działającej weryfikacji przed każdym wycinkiem)
- **Unlocks:** ścieżka weryfikacji (lint + typy + build) dla każdego kolejnego wycinka, zaczynając od S-01.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimalna zmiana, ale bez niej żaden wycinek nie jest automatycznie weryfikowany; wykonanie jako pierwszej ogranicza ryzyko braku sprawdzeń przy napiętym terminie.
- **Status:** in-progress

## Slices

### S-01: Sesja rozpoznawania z informacją zwrotną

- **Outcome:** user can zalogować się e-mailem, wybrać alfabet (hiragana lub katakana) i kierunek nauki, przejść sesję 10–15 znaków z 4 opcjami odpowiedzi i po każdej odpowiedzi zobaczyć, czy była dobra.
- **Change ID:** recognition-session-basic
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Zasady doboru 3 błędnych opcji (losowe czy podobne znaki) — Owner: user. Block: no.
- **Risk:** Najmniejszy kompletny przepływ; logowanie e-mailem już istnieje w stanie bazowym, więc wycinek je tylko spina z sesją. Bez zapisu wyników, aby zmieścić się w terminie.
- **Status:** proposed

### S-02: Zapisany wynik sesji

- **Outcome:** user can zobaczyć zapisany wynik sesji; każda odpowiedź jest przypisana do znaku, także błędna (zgodnie z US-01).
- **Change ID:** save-session-results
- **PRD refs:** US-01, FR-007, FR-013
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Definicja „wyniku sesji” widocznego dla użytkownika — Owner: user. Block: no.
- **Risk:** Pierwszy wycinek, który wymaga danych (dziś brak tabel); wybrany jako drugi, bo odblokowuje powtórki błędów i statystyki, a guardrail „wyniki nie giną” zaczyna się tu.
- **Status:** proposed

### S-03: Częstsze powtórki błędnych znaków

- **Outcome:** user can dostawać w sesji znaki, w których się mylił, częściej niż znaki opanowane.
- **Change ID:** error-weighted-repeats
- **PRD refs:** FR-006
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-06
- **Blockers:** —
- **Unknowns:**
  - Dokładna reguła „częściej” (błędny znak pojawia się więcej razy niż opanowany) — Owner: user. Block: no.
- **Risk:** To główny wgląd produktu (powtórki skupione na błędach); sekwencjonowany zaraz po zapisie, bo bez historii odpowiedzi nie da się go zrealizować.
- **Status:** proposed

### S-04: Ćwiczenie w grupach znaków

- **Outcome:** user can ćwiczyć znaki w grupach (np. grupa K: ka, ki, ku, ke, ko); powtórki liczą się i do znaku, i do grupy.
- **Change ID:** group-practice
- **PRD refs:** FR-009, FR-013
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, S-06
- **Blockers:** —
- **Unknowns:**
  - Definicja grup znaków (tylko wg spółgłoski? samogłoski, „n”, dakuten, kombinacje; grupy mniejsze niż sesja 10–15 znaków) — Owner: user. Block: yes.
- **Risk:** Najbardziej niedookreślony wycinek PRD; zablokowany, aż grupy zostaną zdefiniowane, bo planowanie bez definicji grup oznaczałoby zgadywanie zakresu.
- **Status:** blocked

### S-05: Opanowanie grup i siła znajomości

- **Outcome:** user can zobaczyć, które grupy ma opanowane, oraz siłę znajomości grupy i znaku w 3-stopniowej skali kolorów.
- **Change ID:** group-mastery-view
- **PRD refs:** FR-010, FR-011
- **Prerequisites:** S-02, S-04
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - Definicja „siły znajomości”, progów 3-stopniowej skali i kryterium „grupa opanowana” — Owner: user. Block: yes.
  - Drugi sygnał poza kolorem dla osób z zaburzeniami widzenia barw — Owner: user. Block: no.
- **Risk:** Najcięższy ekran MVP według rundy wyzwań PRD; zależy od grup i od nierozstrzygniętych progów, więc jest sekwencjonowany na końcu.
- **Status:** blocked

### S-06: Hot-5 — najtrudniejsze znaki

- **Outcome:** user can zobaczyć 5 znaków, w których myli się najczęściej.
- **Change ID:** hot-five-difficult-chars
- **PRD refs:** FR-012
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Mały, samodzielny widok oparty na statystykach per znak z S-02; po stronie ryzyka — na początku lista jest przypadkowa przy małej liczbie odpowiedzi.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                     | Ready for `/10x-plan` | Notes                                   |
| ---------- | ------------------------- | --------------------------------------------------------- | --------------------- | --------------------------------------- |
| F-01       | ci-on-main-branch         | Uruchamiaj CI na gałęzi main                              | yes                   | Run `/10x-plan ci-on-main-branch`       |
| S-01       | recognition-session-basic | Sesja rozpoznawania znaków z informacją zwrotną           | no                    | Czeka na F-01                           |
| S-02       | save-session-results      | Zapis wyniku sesji i odpowiedzi per znak                  | no                    | Czeka na S-01                           |
| S-03       | error-weighted-repeats    | Częstsze powtórki błędnych znaków                         | no                    | Czeka na S-02                           |
| S-04       | group-practice            | Ćwiczenie znaków w grupach                                | no                    | Zablokowany: definicja grup znaków      |
| S-05       | group-mastery-view        | Widok opanowania grup i siły znajomości                   | no                    | Zablokowany: progi siły znajomości      |
| S-06       | hot-five-difficult-chars  | Widok hot-5 najtrudniejszych znaków                       | no                    | Czeka na S-02                           |

## Open Roadmap Questions

1. **Mierzalne cele skali (`qps`, `data_volume`)** — Owner: user. Block: roadmap-wide (nie blokuje wycinków, ale PRD ma puste pola).
2. **Dostawcy logowania zewnętrznego (FR-015, nice-to-have)** — Owner: user. Block: żaden wycinek MVP.
3. **Mierzalny cel „płynnej reakcji”** — Owner: user. Block: roadmap-wide.
4. **Zasady doboru 3 błędnych opcji w pytaniu** — Owner: user. Block: S-01 (nie blokuje).
5. **Definicja „wyniku sesji”** — Owner: user. Block: S-02 (nie blokuje).
6. **Dostępność skali siły znajomości (drugi sygnał poza kolorem)** — Owner: user. Block: S-05 (nie blokuje).
7. **Definicja „siły znajomości”, progów skali i kryterium „grupa opanowana”** — Owner: user. Block: S-05.
8. **Czy statystyka znaku liczy oba kierunki nauki razem, czy osobno** — Owner: user. Block: S-02, S-06 (nie blokuje).
9. **Definicja grup znaków** — Owner: user. Block: S-04, S-05.
10. **Ścieżka pisania — sposób oceniania kresek** — Owner: user. Block: poza kamieniem milowym.
11. **Ścieżka pisania — źródło danych wzorcowych** — Owner: user. Block: poza kamieniem milowym.
12. **Podpowiedź po 2 błędach** — Owner: user. Block: poza kamieniem milowym.
13. **Zakres na drugi termin** — Owner: user. Block: roadmap-wide.

## Parked

- **FR-008: ćwiczenie tylko błędnych znaków** — Why parked: nice-to-have; może dublować powtórki błędów (S-03) i hot-5 (S-06), do oceny po MVP.
- **FR-014: rozwijanie grupy do statystyk poszczególnych znaków** — Why parked: nice-to-have wydzielone z FR-010 w rundzie wyzwań (uproszczenie zakresu).
- **FR-015: logowanie kontem zewnętrznym (Apple/Google)** — Why parked: nice-to-have; podstawą MVP jest logowanie e-mailem.
- **Ścieżka pisania** (rysowanie, linie pomocnicze, ocena kresek, wzorzec i animacja kolejności kresek) — Why parked: PRD §Non-Goals, drugi termin.
- **Role, udostępnianie, rankingi, funkcje społecznościowe** — Why parked: PRD §Non-Goals.
- **Płatności i subskrypcje** — Why parked: PRD §Non-Goals.

## Milestone History

## Done
