---
project: "HiraKana"
version: 1
status: draft
created: 2026-11-07
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: # TODO: target_scale.qps — see Open Questions
  data_volume: # TODO: target_scale.data_volume — see Open Questions
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-05
  after_hours_only: true
---

## Vision & Problem Statement

Użytkownikowi trudno zapamiętać znaki hiragany i katakany, a brak ich znajomości mocno utrudnia naukę języka, co prowadzi do zniechęcenia. Dziś korzysta z popularnej aplikacji do nauki języków, ale chce „lekkiej” wersji tylko do ćwiczenia alfabetów; istniejące aplikacje do alfabetów są płatne i nie podobają się graficznie.

Wgląd (wg użytkownika): powtórki skupione na błędach — aplikacja sama wraca do znaków, które sprawiają trudność.

Aplikacja uczy przede wszystkim zapamiętania par: znak japoński ↔ jego dwuliterowy zapis (transkrypcja łacińska, np. か → „ka”). Dwie ścieżki nauki:
1. **Rozpoznawanie (MVP):** użytkownik widzi znak japoński i z listy np. 4 dwuliterowych zapisów wybiera właściwy; oraz odwrotnie: widzi dwuliterowy zapis i z listy 4 znaków wybiera właściwy.
2. **Pisanie (druga ścieżka, po MVP):** rysowanie znaku na iPhonie lub iPadzie w Safari (piórem lub palcem), linie pomocnicze znikające po 3 powtórkach, wzorzec po napisaniu, błędny znak wraca częściej.

## User & Persona

Główna persona: dorosły samouk, początkujący w japońskim (użytkownik i osoby w jego sytuacji), na etapie nauki hiragany i katakany; chce lekkiego narzędzia tylko do alfabetów. Moment sięgnięcia po produkt: ćwiczenie zapamiętywania znaków.

## Success Criteria

### Primary
Działający przepływ MVP (ścieżka rozpoznawania; hiragana i katakana od razu; oba kierunki):
1. Użytkownik otwiera aplikację i loguje się.
2. Wybiera alfabet (hiragana lub katakana) oraz kierunek nauki: znak japoński → zapis łaciński albo zapis łaciński → znak japoński.
3. Widzi pytanie i wybiera właściwą odpowiedź spośród 4.
4. Dostaje informację, czy odpowiedź jest dobra.
5. Błędnie rozpoznane znaki wracają częściej.
6. Wynik sesji jest zapisany na koncie.

Estymacja: 3 tygodnie pracy po godzinach (mieści się w budżecie czasu).

### Secondary
- Tryb ćwiczenia błędnych znaków (osobna sesja złożona ze znaków, w których użytkownik się mylił).

### Guardrails
- Aplikacja jest czytelna i wygodna na iPhonie i iPadzie w Safari.
- Wyniki użytkownika nie giną.

## User Stories

### US-01: Błędna odpowiedź jest oznaczona i zapisana w statystykach

- **Given** znak hiragany z czterema widocznymi opcjami odpowiedzi
- **When** użytkownik wybierze odpowiedź błędnie
- **Then** widzi oznaczenie „błędnie” i błędny znak zostaje przypisany w statystykach

## Functional Requirements

### Authentication
- FR-001: Użytkownik can zalogować się istniejącym kontem zewnętrznym (dostawcy — zob. Open Questions). Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano.

### Learning session
- FR-002: Użytkownik can wybrać alfabet (hiragana lub katakana). Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano.
- FR-003: Użytkownik can wybrać kierunek nauki (znak japoński → zapis łaciński albo zapis łaciński → znak japoński). Priority: must-have
  > Socrates: Kontrargument: "jeden kierunek wystarczy, by udowodnić pomysł." Resolution: zostają oba kierunki w MVP.
- FR-004: Użytkownik can odpowiedzieć na pytanie, wybierając jedną z 4 opcji, i od razu zobaczyć, czy odpowiedź jest dobra. Priority: must-have
  > Socrates: Kontrargument: "dobrane złe opcje decydują o trudności." Resolution: otwarte — zasady doboru błędnych opcji w Open Questions.
- FR-005: Użytkownik can przejść sesję złożoną z 10–15 znaków, w której jeden znak powtarza się maksymalnie 3 razy. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano.
- FR-006: Aplikacja can częściej powtarzać znaki, w których użytkownik się mylił — błędny znak pojawia się w sesji więcej razy niż znak opanowany. Priority: must-have
  > Socrates: Kontrargument: "nie wiadomo, co znaczy 'częściej'." Resolution: doprecyzowane mierzalnie (więcej razy niż znak opanowany); dokładna reguła do planowania.
- FR-008: Użytkownik can ćwiczyć tylko znaki, w których się mylił. Priority: nice-to-have
  > Socrates: Kontrargument: "pokrywa się z FR-006 i hot-5 (FR-012)." Resolution: otwarte — zostaje jako nice-to-have; do oceny po MVP.
- FR-009: Użytkownik can ćwiczyć znaki w grupach (np. grupa K: ka, ki, ku, ke, ko). Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano.

### Progress & statistics
- FR-007: Użytkownik can zobaczyć zapisany wynik sesji. Priority: must-have
  > Socrates: Kontrargument: "niedoprecyzowane, co oznacza 'wynik'." Resolution: otwarte — definicja wyniku w Open Questions.
- FR-010: Użytkownik can zobaczyć, które grupy ma opanowane. Priority: must-have
  > Socrates: Kontrargument: "najcięższy ekran MVP." Resolution: uproszczone — grupy w MVP; rozwijanie do znaków wydzielone do FR-014 (nice-to-have).
- FR-014: Użytkownik can rozwinąć grupę i zobaczyć osobne statystyki (postęp) dla poszczególnych znaków. Priority: nice-to-have
  > Socrates: Wydzielone z FR-010 po rundzie wyzwań (uproszczenie zakresu).
- FR-011: Użytkownik can zobaczyć siłę znajomości grupy i znaku w 3-stopniowej skali kolorów. Priority: must-have
  > Socrates: Kontrargument: "sam kolor jest niedostępny dla osób z zaburzeniami widzenia barw." Resolution: otwarte — skala ma mieć sygnał inny niż sam kolor (do planowania; Open Questions).
- FR-012: Użytkownik can zobaczyć „hot-5” — 5 najtrudniejszych znaków, w których najczęściej się myli. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano. (Uwaga: zależy od zbierania statystyk per znak, także gdy FR-014 jest po MVP.)
- FR-013: Aplikacja can zaliczać każde powtórzenie znaku zarówno do statystyk znaku, jak i jego grupy, także gdy znak pojawia się podczas ćwiczenia całego alfabetu (nie tylko w trybie grupowym). Priority: must-have
  > Socrates: Brak kontrargumentu; stoi tak, jak napisano.

## Non-Functional Requirements

- Aplikacja jest czytelna i wygodna w użyciu na iPhonie i iPadzie w Safari.
- Wyniki użytkownika nie giną.
- Aplikacja reaguje płynnie na akcje użytkownika. # TODO: mierzalny cel czasu reakcji — see Open Questions

## Business Logic

Aplikacja dobiera znaki do sesji tak, że znaki, w których użytkownik się myli, wracają częściej, a siła znajomości znaku i grupy wynika z historii jego odpowiedzi.

Wejścia widoczne dla użytkownika: odpowiedzi w sesjach, wybrany alfabet, kierunek i grupa. Wynik reguły: skład sesji (10–15 znaków, znak maksymalnie 3 razy) oraz siła znajomości znaku i grupy w 3-stopniowej skali. Użytkownik spotyka regułę w każdej sesji (które znaki dostaje i jak często wracają błędne) oraz w widoku postępu (siła znajomości).

## Access Control

Logowanie istniejącym kontem zewnętrznym (dostawcy — zob. Open Questions). Płaski model użytkowników — wszyscy równi, bez ról; każdy widzi tylko swoje wyniki. Wyniki są zapisywane na koncie użytkownika.

## Non-Goals

- Ścieżka pisania (rysowanie znaków, linie pomocnicze, ocena kresek, wzorzec i animacja kolejności kresek) — poza MVP; wchodzi w drugim terminie.
- Role, udostępnianie, rankingi, funkcje społecznościowe — wyniki są prywatne, płaski model użytkowników.
- Płatności i subskrypcje — aplikacja ma być lekka, w odróżnieniu od istniejących płatnych aplikacji.

## Open Questions

1. **Mierzalne cele skali (`target_scale.qps`, `target_scale.data_volume`)** — nie ustalono; skala użytkowników: „tylko ja albo garstka osób”. Owner: użytkownik.
2. **Dostawcy logowania** — użytkownik wskazał dwóch dostawców kont zewnętrznych (Apple i Google); decyzja o nazwach dostawców trafia do etapu wyboru stacku. Owner: użytkownik / tech-stack.
3. **Mierzalny cel „płynnej reakcji”** (np. czas reakcji po wyborze opcji) — nierozstrzygnięte. Owner: użytkownik.
4. **Zasady doboru 3 błędnych opcji w pytaniu** (losowe czy podobne znaki) — nierozstrzygnięte (FR-004). Owner: użytkownik.
5. **Definicja „wyniku sesji”** widocznego dla użytkownika — nierozstrzygnięte (FR-007). Owner: użytkownik.
6. **Dostępność skali siły znajomości** — skala kolorów potrzebuje drugiego sygnału poza kolorem (FR-011). Owner: użytkownik.
7. **Definicja „siły znajomości”, progów 3-stopniowej skali oraz kryterium „grupa opanowana”** — nierozstrzygnięte (FR-006, FR-010, FR-011). Owner: użytkownik.
8. **Czy statystyka znaku liczy oba kierunki nauki razem, czy osobno** — nierozstrzygnięte. Owner: użytkownik.
9. **Definicja grup znaków** — czy tylko według spółgłoski (K, S, T…), a jak z samogłoskami, „n”, dakuten i kombinacjami; oraz co przy grupach mniejszych niż 10 znaków względem sesji 10–15 znaków (FR-005, FR-009). Owner: użytkownik.
10. **Ścieżka pisania — sposób oceniania kresek** — nierozstrzygnięte (po MVP). Owner: użytkownik.
11. **Ścieżka pisania — źródło danych wzorcowych** — nierozstrzygnięte (po MVP). Owner: użytkownik.
12. **Podpowiedź po 2 błędach** — opcjonalna, po pierwszym kamieniu milowym. Owner: użytkownik.
13. **Zakres na drugi termin** — nierozstrzygnięte. Owner: użytkownik.
