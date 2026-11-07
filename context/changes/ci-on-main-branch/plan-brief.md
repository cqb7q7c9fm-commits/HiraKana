# Uruchamiaj CI na gałęzi main — Plan Brief

> Full plan: `context/changes/ci-on-main-branch/plan.md`

## What & Why

Workflow CI nasłuchuje na `master`, a repozytorium używa `main`, więc żadne sprawdzenie nigdy się nie uruchamia. Naprawiamy to jako fundament F-01, aby każdy następny wycinek (od S-01) był automatycznie weryfikowany.

## Starting Point

`.github/workflows/ci.yml` ma już poprawne joby `ci` (lint, typy, build) i `smoke` (lokalny Supabase + przepływ logowania), ale z `branches: [master]` i na sztywno `node-version: 26`. `AGENTS.md` i `CLAUDE.md` powtarzają błąd z `master`. Nie ma zdalnego repozytorium ani testów poza smoke.

## Desired End State

Push i PR do `main` uruchamiają równolegle `ci` i `smoke` z Node z `.nvmrc`. Dokumentacja agentów opisuje rzeczywisty przepływ, a ręczne kroki po stronie GitHuba są jasno wskazane.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Zakres wdrożenia | Tylko CI, bez deployu | Zgodne z Outcome F-01 i bez sekretów Cloudflare, których nie da się sprawdzić bez zdalnego repo. | Plan |
| Job smoke | Na push i PR, równolegle z `ci` | Każdy wycinek jest weryfikowany przepływem logowania przed merge. | Plan |
| Wersja Node | `node-version-file: .nvmrc` | Jedno źródło prawdy zgodne z `AGENTS.md` (26.13.0). | Plan |

## Scope

**In scope:** wyzwalacze na `main`, Node z `.nvmrc`, sekcja CI w `AGENTS.md`/`CLAUDE.md`, status F-01 w roadmapie.

**Out of scope:** wdrożenie na Cloudflare, testy jednostkowe i E2E, dodatkowy cache, automatyczna branch protection.

## Architecture / Approach

Edycja jednego pliku workflow (dwie zmiany), potem dokumentacji. Joby `ci` i `smoke` zostają niezależne i równoległe; build w `ci` używa sekretów repozytorium, a `smoke` generuje własny `.env` z lokalnego Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wyzwalacze i Node | `ci.yml` na `main` z Node z `.nvmrc` | Brak zdalnego repo, więc zielony bieg nie jest sprawdzalny lokalnie |
| 2. Dokumentacja i kroki ręczne | Zgodne `AGENTS.md`/`CLAUDE.md`, status roadmapy, lista kroków GitHub | Kroki ręczne zależą od utworzenia zdalnego repo i sekretów |

**Prerequisites:** zdalne repozytorium na GitHubie i sekrety `SUPABASE_URL`, `SUPABASE_KEY` (tylko do weryfikacji ręcznej).
**Estimated effort:** ~1 sesja, 2 małe fazy.

## Open Risks & Assumptions

- Zakładamy, że `smoke` przejdzie na runnerze GitHub z Dockerem; nie da się tego sprawdzić bez zdalnego repo.
- Node 26.13.0 musi być dostępny w `actions/setup-node`.

## Success Criteria (Summary)

- W workflow i dokumentacji nie ma `master`.
- Push i PR do `main` uruchamiają zielone joby `ci` i `smoke`.
