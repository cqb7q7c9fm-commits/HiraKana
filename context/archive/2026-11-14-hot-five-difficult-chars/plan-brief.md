# Hot-5 — najtrudniejsze znaki — Plan Brief

> Full plan: `context/changes/hot-five-difficult-chars/plan.md`

## What & Why

Dodajemy chronioną stronę `/hot-5`, która pokazuje do 5 znaków, w których użytkownik myli się najczęściej (FR-012, S-06). To zamyka „wgląd” produktu po stronie widoku: aplikacja nie tylko częściej powtarza błędne znaki (S-03), ale też pokazuje je użytkownikowi.

## Starting Point

Odpowiedzi per znak są już zapisywane (S-02), a `getCharStats` zwraca dla każdego znaku liczbę odpowiedzi i błędów z ostatnich 5 odpowiedzi (oba kierunki razem). Nie ma jeszcze żadnego widoku statystyk; `/dashboard` ma tylko przyciski „Start practice” i „Results”.

## Desired End State

Po zalogowaniu `/hot-5` pokazuje listę 0–5 znaków od najtrudniejszego: hiragana i katakana, romaji oraz „błędy/odpowiedzi” (np. `3/5`). Gdy w oknie nie ma błędów, widać stan pusty z linkiem do ćwiczeń. Z `/dashboard` prowadzi link „Hot-5”.

## Key Decisions Made

| Decision        | Choice                                                                   | Why (1 sentence)                                                                             |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Ranking         | Odsetek błędów (`errors/answers`) malejąco                               | Mierzy „w którym znaku się myli” niezależnie od tego, jak często był ćwiczony.               |
| Remis           | Więcej błędów, potem romaji rosnąco                                      | Deterministyczny wynik; `ki 5/5` wyprzedza `ka 1/1` jako mocniejszy dowód trudności.         |
| Okno danych     | Ostatnie 5 odpowiedzi (`recent_char_stats`)                              | Zero migracji i ta sama definicja „ostatnich” co w S-03.                                     |
| Mało danych     | Tylko znaki z ≥1 błędem w oknie; brak progu liczby odpowiedzi            | Lista nigdy nie wskazuje znaku bez błędów; krótsza lista lub stan pusty to uczciwy wynik.    |
| Miejsce         | Strona `/hot-5` + link z dashboardu                                      | Wzorzec `/results`, niezależne od S-05 i dashboardu jako całości.                            |
| Testowanie      | Tylko test ręczny (bez nowych testów automatycznych)                     | Mały, jednorazowy widok; istniejące lint/check/build/smoke chronią przed regresją.           |

## Scope

**In scope:** funkcja `rankHotFive`, strona `/hot-5`, ochrona trasy, link z dashboardu, stan pusty.

**Out of scope:** migracje i nowe funkcje SQL, próg liczby odpowiedzi, dopełnianie listy znakami bez błędów, statystyki grup i siła znajomości (S-05), „ćwicz tylko hot-5” (FR-008), nowe testy automatyczne, nowy endpoint API.

## Architecture / Approach

Strona SSR woła `getCharStats(supabase)` (istniejąca funkcja SQL z oknem 5), przekazuje wynik do czystej `rankHotFive` w `src/lib/hot-five.ts` i renderuje listę, mapując `romaji` na znaki z `KANA`. Odsetki porównywane są krzyżowo, żeby remisy były dokładne.

## Phases at a Glance

| Phase                                | What it delivers                                                    | Key risk                                                               |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Ranking i strona /hot-5           | `rankHotFive`, strona SSR, ochrona trasy, stan pusty                | Błędna kolejność remisów lub pokazanie znaku bez błędów               |
| 2. Wejście z dashboardu i weryfikacja | Link na dashboardzie, ręczny test reguły, regresja (lint/build/smoke) | Test ręczny nie chroni reguły przed przyszłą regresją                  |

**Prerequisites:** S-02 (zapis odpowiedzi) i S-03 (`recent_char_stats`) są gotowe.
**Estimated effort:** ~1 sesja, 2 małe fazy.

## Open Risks & Assumptions

- Znak z 1 błędem w 1 odpowiedzi trafia na szczyt (brak progu) — świadomie przyjęte; „błędy/odpowiedzi” przy znaku pokazuje, na czym opiera się pozycja.
- Okno 5 daje wiele remisów, więc kolejność po romaji będzie często widoczna.
- Brak testów automatycznych: reguła rankingu zależy od testu ręcznego.
- Zakładamy, że prace nad S-04 (niezacommitowane w drzewie roboczym) nie zmieniają `KANA` ani `getCharStats` w sposób łamiący mapowanie `romaji` → znak.

## Success Criteria (Summary)

- Użytkownik widzi do 5 znaków, w których myli się najczęściej, w przewidywalnej kolejności.
- Nowy użytkownik lub brak błędów daje czytelny stan pusty, a nie przypadkową listę.
- Widok działa na iPhonie/iPadzie w Safari, a lint, `astro check`, build i smoke przechodzą.
