---
project: "HiraKana"
context_type: greenfield
created: 2026-11-07
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-05
  after_hours_only: true
updated: 2026-11-07
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kategoria problemu"
      decision: "nie tylko pisanie — nauka zapamiętania par znak <-> dwuliterowy zapis; dwie ścieżki: (1) rozpoznawanie, (2) pisanie; v1 skupia się na ścieżce 1"
    - topic: "wgląd"
      decision: "powtórki skupione na błędach"
    - topic: "persona"
      decision: "dorosły samouk, początkujący w japońskim"
    - topic: "dostęp"
      decision: "logowanie przez OAuth (Apple/Google); płaski model użytkowników, bez ról"
  frs_drafted: 14
  quality_check_status: accepted
---

# Shape notes

## Seed idea (verbatim)

Aplikacja webowa w Safari (iPhone i iPad, Apple Pencil) do nauki hiragany i katakany przez rysowanie znaków. Początkowo pokazuje linie pomocnicze, po 3 powtórkach znaku znikają. Po napisaniu znaku pokazuje wzorzec (opcjonalnie animację kolejności kresek). Błędny znak wraca częściej. Logowanie i zapis wyników. Nierozstrzygnięte: sposób oceniania kresek, źródło danych wzorcowych, podpowiedź po 2 błędach (opcjonalnie, po pierwszym kamieniu milowym), zakres na drugi termin.

## Open Questions (from seed)

- Sposób oceniania kresek — nierozstrzygnięte.
- Źródło danych wzorcowych — nierozstrzygnięte.
- Podpowiedź po 2 błędach — opcjonalna, po pierwszym kamieniu milowym.
- Zakres na drugi termin — nierozstrzygnięte.

## Vision & Problem Statement

Użytkownikowi trudno zapamiętać znaki hiragany i katakany, a brak ich znajomości mocno utrudnia naukę języka, co prowadzi do zniechęcenia. Dziś korzysta z Duolingo, ale chce „lekkiej” wersji tylko do ćwiczenia alfabetów; istniejące aplikacje do alfabetów są płatne i nie podobają się graficznie.

Wgląd (wg użytkownika): powtórki skupione na błędach — aplikacja sama wraca do znaków, które sprawiają trudność.

Aplikacja uczy przede wszystkim **zapamiętania par: znak japoński <-> jego dwuliterowy zapis (transkrypcja łacińska, np. か → „ka”; potwierdzone)**. Dwie ścieżki nauki:
1. **Rozpoznawanie (v1 — pierwszy fokus):** widzę znak japoński i z listy np. 4 dwuliterowych zapisów wybieram właściwy; oraz odwrotnie: widzę dwuliterowy zapis i z listy 4 znaków wybieram właściwy.
2. **Pisanie (druga ścieżka, później):** rysowanie znaku (Safari, iPhone/iPad, Apple Pencil lub palec — "bo to akurat mam na stanie"), linie pomocnicze znikające po 3 powtórkach, wzorzec po napisaniu, błędny znak wraca częściej.

> Uwaga: pierwotny opis zalążkowy był skoncentrowany na rysowaniu; użytkownik doprecyzował, że rysowanie jest drugą ścieżką, a MVP skupia się na ścieżce rozpoznawania.

## User & Persona

Główna persona: dorosły samouk, początkujący w japońskim (użytkownik i osoby w jego sytuacji), na etapie nauki hiragany i katakany; korzysta lub korzystał z Duolingo i chce lekkiego narzędzia tylko do alfabetów. Moment: ćwiczenie zapamiętywania znaków.

## Access Control

Logowanie przez OAuth (Apple/Google). Płaski model użytkowników — wszyscy równi, każdy widzi tylko swoje wyniki. Wyniki zapisywane na koncie.

## Success Criteria

### Primary
Działający przepływ MVP (ścieżka rozpoznawania; hiragana i katakana od razu; oba kierunki):
1. Użytkownik otwiera aplikację i loguje się przez Apple/Google.
2. Wybiera alfabet (hiragana lub katakana) oraz kierunek nauki: znak japoński → zapis łaciński albo zapis łaciński → znak japoński.
3. Widzi pytanie i wybiera właściwą odpowiedź spośród 4.
4. Dostaje informację, czy odpowiedź jest dobra.
5. Błędnie rozpoznane znaki wracają częściej.
6. Wynik sesji jest zapisany na koncie.

Zakres MVP: tylko ścieżka rozpoznawania; pisanie (rysowanie) poza MVP. Estymacja użytkownika: 3 tygodnie po godzinach — mieści się w budżecie, bez potrzeby potwierdzenia kosztu.

### Secondary
- Tryb ćwiczenia błędnych znaków (osobna sesja złożona ze znaków, w których użytkownik się mylił).

### Guardrails
- Aplikacja jest czytelna i wygodna na iPhonie i iPadzie w Safari.
- Wyniki użytkownika nie giną.

## Functional Requirements

### Authentication
- FR-001: Użytkownik can zalogować się przez Apple/Google. Priority: must-have
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

## User Stories

### US-01: Błędna odpowiedź jest oznaczona i zapisana w statystykach

- **Given** znak hiragany z czterema widocznymi opcjami odpowiedzi
- **When** użytkownik wybierze odpowiedź błędnie
- **Then** widzi oznaczenie „błędnie” i błędny znak zostaje przypisany w statystykach

## Business Logic

Aplikacja dobiera znaki do sesji tak, że znaki, w których użytkownik się myli, wracają częściej, a siła znajomości znaku i grupy wynika z historii jego odpowiedzi.

(Reguła potwierdzona przez użytkownika. Wejścia widoczne dla użytkownika: odpowiedzi w sesjach, wybrany alfabet, kierunek i grupa. Wynik: skład sesji (10–15 znaków, znak maks. 3 razy) oraz siła znajomości znaku i grupy w 3-stopniowej skali. Szczegóły reguły wag i progów: Open Questions.)

## Non-Functional Requirements

- Aplikacja jest czytelna i wygodna w użyciu na iPhonie i iPadzie w Safari.
- Wyniki użytkownika nie giną.
- Aplikacja działa offline: użytkownik może ćwiczyć bez połączenia z internetem. # TODO: zakres offline (czy logowanie i synchronizacja wyników wymagają sieci) — see Open Questions
- Aplikacja reaguje płynnie na akcje użytkownika. # TODO: mierzalny cel czasu reakcji — see Open Questions

## Zasady sesji nauki (zgłoszone w Fazie 3, do ujęcia w FR / Business Logic)

- Nauka nie trwa w nieskończoność: jedna sesja to 10–15 znaków.
- Jeden znak może się powtórzyć w jednej sesji maksymalnie 3 razy.
- Tryb nauki w grupach, np. ka, ko, ku, ki, ke — status (MVP czy później) do ustalenia w Fazie 4.

## Non-Goals

- Ścieżka pisania (rysowanie znaków, linie pomocnicze, ocena kresek, wzorzec/animacja kolejności kresek) — poza MVP; wchodzi w drugim terminie.
- Role, udostępnianie, rankingi, funkcje społecznościowe — wyniki są prywatne, płaski model użytkowników.
- Płatności i subskrypcje — aplikacja ma być lekka, w odróżnieniu od istniejących płatnych aplikacji.

(Podpowiedź po 2 błędach nie została wykluczona; pozostaje opcjonalna, po pierwszym kamieniu milowym.)

## Framing notes

- Skala: tylko użytkownik lub garstka osób; przy 100x skali reguła domenowa się nie zmienia (wg użytkownika).
- Termin: 2026-12-05, praca po godzinach; MVP 3 tygodnie.

## Open Questions (running)

- Zakres działania offline: co działa bez sieci (sesje, zapis wyników), a co wymaga sieci (logowanie przez Apple/Google, synchronizacja między iPhonem i iPadem) — nierozstrzygnięte; wynika z napięcia między NFR offline a logowaniem OAuth.
- Mierzalny cel „płynnej reakcji” (np. czas odpowiedzi po wyborze opcji) — nierozstrzygnięte.
- Zasady doboru 3 błędnych opcji w pytaniu (losowe czy podobne znaki) — nierozstrzygnięte (FR-004).
- Definicja „wyniku sesji” widocznego dla użytkownika (FR-007) — nierozstrzygnięte.
- Kolor jako jedyny sygnał siły znajomości (dostępność) — potrzebny drugi sygnał (FR-011).
- Czy statystyka znaku liczy oba kierunki nauki razem, czy osobno — nierozstrzygnięte.
- Co przy grupach mniejszych niż 10 znaków względem sesji 10–15 znaków (FR-005, FR-009) — nierozstrzygnięte.
- Definicja „siły znajomości” i progów 3-stopniowej skali kolorów oraz kryterium „grupa opanowana” — nierozstrzygnięte (do PRD / planowania).
- Definicja grup znaków (czy tylko wg spółgłoski: K, S, T…, a jak z samogłoskami, „n”, dakuten, kombinacje) — nierozstrzygnięte.

- Sposób oceniania kresek (ścieżka pisania) — nierozstrzygnięte.
- Źródło danych wzorcowych — nierozstrzygnięte.
- Podpowiedź po 2 błędach — opcjonalna, po pierwszym kamieniu milowym.
- Zakres na drugi termin — nierozstrzygnięte.
- Tryb nauki w grupach (ka, ko, ku, ki, ke): czy w MVP, czy po MVP — do ustalenia w Fazie 4.
- Zakres MVP: docelowo rozpoznawanie + pisanie; MVP prawdopodobnie tylko rozpoznawanie — do ostatecznego zablokowania w Fazie 3.

## Quality cross-check

Status: accepted — wszystkie 6 pozycji obecnych (Access Control, Business Logic, Project artifacts, Timeline-cost ack, Non-Goals; Preserved behavior n/a dla greenfield). Brak braków do odzwierciedlenia, poza otwartymi pytaniami wymienionymi wyżej; nazwa projektu nadal nieustalona (project: null).
