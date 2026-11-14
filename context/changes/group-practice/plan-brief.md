# Ćwiczenie w grupach znaków — Plan Brief

> Full plan: `context/changes/group-practice/plan.md`

## What & Why

Użytkownik może ćwiczyć znaki w grupach (np. K: ka ki ku ke ko) zamiast tylko całego alfabetu (FR-009). Każdy znak należy do dokładnie jednej z 13 zatwierdzonych grup, więc powtórka liczy się do znaku i do grupy także w trybie „Wszystkie” (FR-013) — to fundament pod widok opanowania grup (S-05).

## Starting Point

Po S-01, S-02 i S-03 sesja 10 pytań działa, zapisuje odpowiedzi w Supabase i losuje znaki ważone błędami (limit 3 powtórzeń dla znaku z błędami, 1 dla pozostałych, bez sąsiednich duplikatów). Faza 1 tego planu jest już zrobiona (`817f070`): `KANA` ma 71 znaków z polem `group`, jest `KANA_GROUPS` i niezmienniki danych. Losowanie z S-03 nie nadaje się do grupy 5-znakowej, bo limit 1 dałby najwyżej 5 pytań. Grupa nie jest zapisana w bazie, ale wynika z `romaji`.

## Desired End State

Na `/practice` użytkownik wybiera alfabet, kierunek i grupę („Wszystkie” albo jedna z 13). Sesja ma zawsze 10 pytań; w grupie K bez historii błędów każdy znak pada 2 razy, a znaki z błędami padają częściej (do 3 razy). „Practice again” zachowuje grupę, a podsumowanie i historia pokazują każdy pomylony znak raz.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Grupy | 13 grup z roadmapy; ぢ/づ jako „di”/„du” | Zatwierdzone 2026-11-14, zapis jednoznaczny w obu kierunkach. | Roadmap |
| „Cały alfabet” | Wszystkie 71 znaków jednego alfabetu | Spełnia FR-013; hiragany i katakany nie mieszamy. | Plan |
| Błędne opcje | W grupie 3 z tej samej grupy; w trybie „Wszystkie” z całego alfabetu | Test ręczny: opcje spoza grupy zdradzały odpowiedź, a każda grupa ma ≥ 5 znaków, więc 4 opcje się mieszczą. | Plan (korekta po teście) |
| Losowanie w grupie | Jedna reguła z S-03: wagi błędów, limit 3 dla znaku z błędami, `ceil(10/n)` dla pozostałych | FR-006 działa też w grupach, a K bez historii daje każdy znak 2x, Z/D 10 różnych. | Plan |
| Sąsiednie duplikaty | Unikane w miarę możliwości, awaryjnie dopuszczone | Spójne z S-03, a małe grupy nie rzucają błędu. | Plan |
| Wybór grupy | Siatka kafelków „Wszystkie” + 13 grup w stylu `ChoiceGroup` | Jedno dotknięcie na iPhonie i iPadzie, spójne z UI. | Plan |
| Zapis grupy | Brak kolumny; grupa wynika z `romaji` | Nie ma migracji; zapis z S-02 działa bez zmian. | Plan |
| Lista pomyłek | Znak raz, bez licznika; X/10 liczy pytania | Zgodne z roadmapą („lista znaków”). | Plan |
| Kolejność prac | Plan fazy 2 i 3 po domknięciu S-02 i S-03 | Wspólne pliki (`session.ts`, hook, `check-session`) bez konfliktów. | Plan |

## Scope

**In scope:** 25 nowych znaków i 13 grup (faza 1, zrobione), `buildSession` z grupą na bazie `pickTargets`, wybór grupy w UI, hook, lista pomyłek bez duplikatów, niezmienniki w `check-session`, smoke dla znaku „di”.

**Out of scope:** zapis grupy w bazie, statystyki i widok grup (S-05), hot-5 (S-06), zmiana wag i limitu 3 z S-03, kombinacje i małe っ, bezwzględny zakaz sąsiednich duplikatów w grupie, nowe zależności testowe.

## Architecture / Approach

Dane (`KANA` 71 + `KANA_GROUPS`, gotowe) → czysta logika (`buildSession(..., random, stats, group)` z uogólnionym `pickTargets`) → hook i UI. Cele pytań i błędne opcje pochodzą z grupy (w trybie „Wszystkie” z całego alfabetu). Limit powtórzeń znaku bez błędów to `ceil(10/n)` dla `n` znaków w puli celów (71 → 1, Z/D → 1, K → 2, Y/W/N → 2), z błędami nadal 3. Zapis z S-02 i `ROMAJI_SET` (wyprowadzony z `KANA`) działają bez zmian.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dane znaków i grupy (zrobione) | `KANA` 71, `KANA_GROUPS`, niezmienniki danych | Pomyłka w kana/romaji, ぢ/づ |
| 2. Logika sesji z grupą | `buildSession` z grupą, limit `ceil(10/n)`, niezmienniki sesji | Losowanie może utknąć w małej grupie (awaryjny sąsiad) |
| 3. UI i hook | Siatka grup, grupa w asynchronicznym `start`, lista pomyłek bez duplikatów, smoke „di” | Układ 14 kafelków na wąskim ekranie |

**Prerequisites:** S-01, S-02 i S-03 zakończone (są w archiwum); lokalny Supabase dla smoke.
**Estimated effort:** ~2 sesje w pozostałych 2 fazach.

## Open Risks & Assumptions

- Tryb „Wszystkie” rośnie z 46 do 71 znaków, więc początkujący zobaczą dakuten przed ich poznaniem (świadoma decyzja).
- Y/W/N (6 znaków, limit 2) może w danej sesji pominąć jeden znak; K zawsze daje 5 × 2, Z/D 10 różnych.
- W sesji grupowej ten sam znak może paść w dwóch kolejnych pytaniach, gdy losowanie nie ma innego wyboru.
- `/results` nie pokazuje grupy sesji; to zadanie S-05.

## Success Criteria (Summary)

- Użytkownik wybiera grupę i dostaje sesję 10 pytań tylko z jej znaków; bez historii błędów K daje każdy znak 2x, a ze statystyką błędów znak z błędami pada częściej.
- Odpowiedzi dla nowych znaków (np. „di”) zapisują się w bazie jak dla podstawowych.
- Każdy pomylony znak widnieje na liście raz, a „Practice again” zachowuje grupę.
