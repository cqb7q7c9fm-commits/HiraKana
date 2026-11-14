---
change_id: group-practice
title: Group practice
status: impl_reviewed
created: 2026-11-14
updated: 2026-11-14
archived_at: null
---

## Notes

Planowanie wstrzymane 2026-11-14: użytkownik zdecydował, że S-04 planujemy dopiero po domknięciu S-02 (`save-session-results`), bo obie zmiany dotykają `start()` w `usePracticeSession` i `SummaryStep`. Wznowienie: `/10x-plan group-practice` na kodzie po S-02.

Decyzje z wywiadu (2026-11-14), do użycia przy wznowieniu:

- Grupy: 13 grup z `context/foundation/roadmap.md` (S-04, Decisions); dodać 25 znaków dakuten/handakuten do `KANA` (razem 71) i pole grupy w `KanaEntry`. Grupa wynika z `romaji`, bez nowej kolumny w bazie.
- Tryb „cały alfabet” = wszystkie znaki jednego wybranego alfabetu (hiragana albo katakana, nigdy razem): 71 znaków w tym alfabecie, tj. 46 podstawowych + 25 z dakuten/handakuten (FR-013: znak liczy się do grupy także tam). Pytania, opcje i błędne opcje pochodzą zawsze z jednego alfabetu. Grupy są wspólne dla obu alfabetów tylko jako podział według romaji.
- Błędne opcje: w sesji grupowej 3 losowane z tej samej grupy (zmiana 2026-11-14 po teście ręcznym: z całego alfabetu odpowiedź było widać po samej grupie); w trybie „Wszystkie” z całego alfabetu.
- Sesja 10 pytań dla grup < 10 znaków: równy rozkład powtórek (np. K: każdy 2x), losowa kolejność; grupy ≥ 10 znaków: 10 różnych znaków. Zmienia niezmiennik „pytania o różne znaki” w `scripts/check-session.mjs`.
- UI: siatka kafelków „Wszystkie” + 13 grup w stylu `ChoiceGroup` w `SetupStep`.
- Do uwzględnienia: lista pomyłek w podsumowaniu używa `key={romaji}`, a przy powtórkach klucze się zdublują (i lista pomyłek w S-02 może zawierać duplikaty).

Faza 2 wstrzymana 2026-11-14: niezatwierdzone zmiany `error-weighted-repeats` (S-03) w `src/lib/services/session.ts`, `src/types.ts` i `scripts/check-session.mjs` kolidują z planem fazy 2 (5. parametr `buildSession` to już `stats`, inne losowanie celów i reguła powtórek). Decyzja: stop and re-plan po zatwierdzeniu S-03; faza 2 planu do przeplanowania na jego kodzie (m.in. pozycja parametru `group`, połączenie z `pickTargets`). Faza 1 zatwierdzona: 817f070.

Przeplanowanie 2026-11-14: S-03 zarchiwizowane (`1de35fa`), plan faz 2 i 3 zaktualizowany na jego kodzie (`pickTargets` uogólnione o grupę, limit `ceil(10/n)`, wagi błędów w grupie, sąsiedzi „w miarę możliwości”, `group` jako 6. parametr `buildSession`). Wznowienie: `/10x-implement group-practice phase 2`.
