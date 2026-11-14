# Ćwiczenie w grupach znaków — Plan Brief

> Full plan: `context/changes/group-practice/plan.md`

## What & Why

Użytkownik może ćwiczyć znaki w grupach (np. K: ka ki ku ke ko) zamiast tylko całego alfabetu (FR-009). Każdy znak należy do dokładnie jednej z 13 zatwierdzonych grup, więc powtórka liczy się do znaku i do grupy także w trybie „Wszystkie” (FR-013) — to fundament pod widok opanowania grup (S-05).

## Starting Point

Po S-01 i S-02 sesja 10 pytań działa i zapisuje odpowiedzi w Supabase. Tablica `KANA` ma 46 znaków podstawowych, a `buildSession` losuje 10 unikalnych znaków z całej tablicy i odrzuca pule mniejsze niż 10, więc grupa 5-znakowa dziś nie przejdzie. Grupa nie jest nigdzie zapisana, ale wynika z `romaji`, które baza już przechowuje.

## Desired End State

Na `/practice` użytkownik wybiera alfabet, kierunek i grupę („Wszystkie” albo jedna z 13). Sesja ma zawsze 10 pytań, a w grupie K każdy znak pada 2 razy. „Practice again” zachowuje grupę, a podsumowanie i historia pokazują każdy pomylony znak raz.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Grupy | 13 grup z roadmapy; ぢ/づ jako „di”/„du” | Zatwierdzone 2026-11-14, zapis jednoznaczny w obu kierunkach. | Roadmap |
| „Cały alfabet” | Wszystkie 71 znaków jednego alfabetu | Spełnia FR-013; hiragany i katakany nie mieszamy. | Plan |
| Błędne opcje | 3 z całego alfabetu, poprawna z grupy | Działa dla każdej grupy; zachowuje obecne zachowanie. | Plan |
| Powtórki w małych grupach | Równy rozkład (K: każdy 2x), losowa kolejność; grupy ≥ 10: 10 różnych | Równa ekspozycja i testowalny niezmiennik, limit 3 z roadmapy. | Plan |
| Wybór grupy | Siatka kafelków „Wszystkie” + 13 grup w stylu `ChoiceGroup` | Jedno dotknięcie na iPhonie i iPadzie, spójne z UI. | Plan |
| Zapis grupy | Brak kolumny; grupa wynika z `romaji` | Nie ma migracji; S-02 działa bez zmian. | Plan |
| Lista pomyłek | Znak raz, bez licznika; X/10 liczy pytania | Zgodne z roadmapą („lista znaków”). | Plan |
| Styk z S-02 | Plan po domknięciu S-02 | Wspólne pliki (`start()`, `SummaryStep`) bez konfliktów. | Plan |

## Scope

**In scope:** 25 nowych znaków i 13 grup, `buildSession` z grupą i powtórkami, wybór grupy w UI, hook, lista pomyłek bez duplikatów, niezmienniki w `check-session`, smoke dla znaku „di”.

**Out of scope:** zapis grupy w bazie, statystyki i widok grup (S-05), hot-5 (S-06), ważone powtórki (S-03), kombinacje i małe っ, rozdzielanie kolejnych pytań o ten sam znak, nowe zależności testowe.

## Architecture / Approach

Dane (`KANA` 71 + `KANA_GROUPS`) → czysta logika (`buildSession(..., random, group)`) → hook i UI. Cele pytań pochodzą z grupy, błędne opcje z całego alfabetu. Dla `n < 10` znaków w grupie każdy znak pada `floor(10/n)` albo `floor(10/n)+1` razy, dla `n ≥ 10` jest 10 różnych. Zapis z S-02 i `ROMAJI_SET` (wyprowadzony z `KANA`) działają bez zmian.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dane znaków i grupy | `KANA` 71, `KANA_GROUPS`, niezmienniki danych | Pomyłka w kana/romaji, ぢ/づ |
| 2. Logika sesji z grupą | `buildSession` z grupą i powtórkami, niezmienniki sesji | Reguła powtórek, błąd na granicy `n = 10` |
| 3. UI i hook | Siatka grup, grupa w hooku, lista pomyłek bez duplikatów, smoke „di” | Układ 14 kafelków na wąskim ekranie |

**Prerequisites:** S-01 i S-02 zakończone (są w archiwum); lokalny Supabase dla smoke.
**Estimated effort:** ~2 sesje w 3 fazach.

## Open Risks & Assumptions

- Tryb „Wszystkie” rośnie z 46 do 71 znaków, więc początkujący zobaczą dakuten przed ich poznaniem (świadoma decyzja).
- Ten sam znak może paść w dwóch kolejnych pytaniach w małej grupie (kolejność losowa, bez reguły rozdzielania).
- `/results` nie pokazuje grupy sesji; to zadanie S-05.

## Success Criteria (Summary)

- Użytkownik wybiera grupę i dostaje sesję 10 pytań tylko z jej znaków, z równymi powtórkami w małych grupach.
- Odpowiedzi dla nowych znaków (np. „di”) zapisują się w bazie jak dla podstawowych.
- Każdy pomylony znak widnieje na liście raz, a „Practice again” zachowuje grupę.
