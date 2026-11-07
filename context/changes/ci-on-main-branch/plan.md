# Uruchamiaj CI na gałęzi main — Implementation Plan

## Overview

Workflow `.github/workflows/ci.yml` nasłuchuje na gałąź `master`, a repozytorium używa `main`, więc CI nigdy się nie uruchamia. Zmiana przełącza wyzwalacze na `main`, bierze wersję Node z `.nvmrc` i poprawia dokumentację, tak aby istniejące sprawdzenia (lint, typy, build, smoke) weryfikowały każdy kolejny wycinek roadmapy, począwszy od S-01.

## Current State Analysis

- `ci.yml` ma dwa joby: `ci` (astro sync, lint, astro check, build) i `smoke` (lokalny Supabase przez `supabase/setup-cli`, build, preview, `npm run smoke`). Oba są poprawne, ale wyzwalane tylko dla `master`.
- Node jest podany na sztywno jako `26`, a `.nvmrc` zawiera `26.13.0`.
- `AGENTS.md` i `CLAUDE.md` (identyczne) w sekcji „CI” mówią o `master` i wspominają tylko lint + build.
- Brak zdalnego repozytorium (`git remote -v` puste), więc sekretów GitHub nie da się sprawdzić ani ustawić stąd.
- Brak testów jednostkowych i E2E; jedyną siatką bezpieczeństwa jest `scripts/smoke.mjs`.
- Brak wdrożenia w workflow; `wrangler.jsonc` istnieje, ale nie ma kroku `wrangler deploy`.

## Desired End State

Push do `main` oraz pull request do `main` uruchamiają równolegle joby `ci` i `smoke`, oba używają Node z `.nvmrc`, a dokumentacja agentów opisuje rzeczywisty przepływ. Weryfikacja: w workflow nie ma już odwołań do `master`, a pierwszy bieg na GitHubie kończy się zielono.

### Key Discoveries:

- `.github/workflows/ci.yml:3-6` — `branches: [master]` w `push` i `pull_request`.
- `.github/workflows/ci.yml:13-16` i `:31-34` — `node-version: 26` w obu jobach.
- `AGENTS.md` i `CLAUDE.md`, sekcja `## CI` — „lint + build on every push and PR to master”.
- `astro.config.mjs` — `SUPABASE_URL`/`SUPABASE_KEY` są `optional: true`, więc build w jobie `ci` przechodzi także bez sekretów (PR z forka).
- `context/foundation/roadmap.md` F-01 — Outcome obejmuje lint, typy, build i smoke, bez wdrożenia.

## What We're NOT Doing

- Wdrożenia na Cloudflare (job `wrangler deploy`, `CLOUDFLARE_API_TOKEN`) — osobna zmiana.
- Testów jednostkowych i E2E (Playwright) oraz nowych kroków testowych.
- Dodatkowego cache poza wbudowanym `cache: npm` w `setup-node`.
- Automatycznego ustawiania branch protection i tworzenia zdalnego repozytorium.
- Zmiany kolejności jobów: `smoke` zostaje równoległy do `ci` i wyzwalany na push i PR.

## Implementation Approach

Minimalna edycja jednego pliku workflow, potem dokumentacji. Faza 1 jest w pełni weryfikowalna lokalnie (składnia YAML, brak `master`, lint/typy/build). Faza 2 aktualizuje dokumentację i opisuje ręczne kroki, których nie da się wykonać bez zdalnego repozytorium.

## Phase 1: Wyzwalacze i wersja Node w ci.yml

### Overview

Przełączenie `ci.yml` na `main` i ujednolicenie wersji Node z `.nvmrc`.

### Changes Required:

#### 1. Wyzwalacze workflow

**File**: `.github/workflows/ci.yml`

**Intent**: CI ma się uruchamiać dla gałęzi, której repozytorium faktycznie używa.

**Contract**: `on.push.branches` i `on.pull_request.branches` mają wartość `[main]`. Żadna inna część `on:` się nie zmienia.

#### 2. Wersja Node z .nvmrc

**File**: `.github/workflows/ci.yml`

**Intent**: Jedno źródło prawdy dla wersji Node (zgodne z `AGENTS.md`: 26.13.0), bez rozjazdu między lokalnym środowiskiem a CI.

**Contract**: W obu krokach `actions/setup-node@v4` (job `ci` i job `smoke`) `node-version: 26` zastąpione przez `node-version-file: .nvmrc`; `cache: npm` zostaje.

### Success Criteria:

#### Automated Verification:

- Składnia YAML jest poprawna: `ruby -ryaml -e 'YAML.load_file(".github/workflows/ci.yml")'`
- Workflow nie zawiera odwołań do `master`: `! grep -n master .github/workflows/ci.yml`
- Oba joby używają `.nvmrc`: `test "$(grep -c 'node-version-file: .nvmrc' .github/workflows/ci.yml)" = 2`
- Linting przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Diff zawiera wyłącznie zmiany wyzwalaczy i wersji Node; joby `ci` i `smoke` pozostają równoległe (brak `needs`).

**Implementation Note**: Po ukończeniu tej fazy i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed następną fazą. Pola wyboru `- [ ]` dla tych pozycji znajdują się w sekcji `## Progress` na dole planu.

---

## Phase 2: Dokumentacja i kroki ręczne

### Overview

Dokumentacja agentów opisuje rzeczywisty przepływ CI na `main`; ręczne kroki po stronie GitHuba zostają jednoznacznie wskazane.

### Changes Required:

#### 1. Sekcja CI w dokumentacji agentów

**File**: `AGENTS.md` oraz `CLAUDE.md`

**Intent**: Dokumentacja ma zgadzać się z workflow: właściwa gałąź i pełny zestaw jobów.

**Contract**: Sekcja `## CI` w obu plikach (utrzymywanych jako identyczne) mówi, że `.github/workflows/ci.yml` na każdy push i PR do `main` uruchamia równolegle job `ci` (lint, `astro check`, build) i job `smoke` (build + `npm run smoke` na podglądzie produkcyjnym z lokalnym Supabase), z wersją Node z `.nvmrc`. Wymagane sekrety repozytorium `SUPABASE_URL` i `SUPABASE_KEY` dotyczą kroku build w jobie `ci`; job `smoke` generuje własne wartości z lokalnego Supabase. Wdrożenie nie jest częścią CI.

#### 2. Status roadmapy

**File**: `context/foundation/roadmap.md`

**Intent**: Odzwierciedlić, że F-01 opuścił backlog i jest planowany.

**Contract**: W tabeli „At a glance” i w bloku `### F-01` pole Status zmienia się z `ready` na `planning`; `updated:` we frontmatter dostaje dzisiejszą datę.

### Success Criteria:

#### Automated Verification:

- Dokumentacja nie wspomina `master`: `! grep -n -w master AGENTS.md CLAUDE.md`
- Oba pliki mają identyczną treść: `diff AGENTS.md CLAUDE.md`
- Formatowanie dokumentów przechodzi: `npx prettier --check AGENTS.md CLAUDE.md`

#### Manual Verification:

- Po utworzeniu zdalnego repozytorium na GitHubie i ustawieniu sekretów `SUPABASE_URL` i `SUPABASE_KEY` push do `main` uruchamia oba joby, a oba kończą się zielono.
- Pull request do `main` uruchamia oba joby (widoczne w zakładce Checks).
- Po pierwszym zielonym biegu włączona jest branch protection na `main` wymagająca jobów `ci` i `smoke`.

**Implementation Note**: Kroki ręczne zależą od zdalnego repozytorium, którego jeszcze nie ma; potwierdź je po jego utworzeniu.

---

## Testing Strategy

### Unit Tests:

- Brak; zmiana dotyczy konfiguracji CI i dokumentacji.

### Integration Tests:

- `smoke` w CI jest właściwym testem integracyjnym: przepływ logowania na podglądzie produkcyjnym z lokalnym Supabase. Nie jest zmieniany.

### Manual Testing Steps:

1. Utwórz zdalne repozytorium na GitHubie i dodaj sekrety `SUPABASE_URL`, `SUPABASE_KEY`.
2. Wypchnij `main` i sprawdź w Actions, że `ci` oraz `smoke` startują i są zielone.
3. Otwórz PR do `main` i potwierdź, że oba joby uruchamiają się na PR.

## Performance Considerations

`smoke` startuje lokalny Supabase w Dockerze, więc PR czeka na dłuższy job. To świadoma decyzja: każdy wycinek jest weryfikowany przepływem logowania przed merge.

## Migration Notes

Brak. Jeśli istnieje gałąź `master` z workflow, nie jest już wyzwalaczem; historia nie wymaga migracji.

## References

- Roadmap: `context/foundation/roadmap.md` (F-01)
- Stack: `context/foundation/tech-stack.md` (`ci_provider: github-actions`)
- Workflow: `.github/workflows/ci.yml:3-6`, `:13-16`, `:31-34`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wyzwalacze i wersja Node w ci.yml

#### Automated

- [x] 1.1 Składnia YAML jest poprawna — 58a84af
- [x] 1.2 Workflow nie zawiera odwołań do `master` — 58a84af
- [x] 1.3 Oba joby używają `.nvmrc` — 58a84af
- [x] 1.4 Linting przechodzi — 58a84af
- [x] 1.5 Sprawdzenie typów przechodzi — 58a84af
- [x] 1.6 Build przechodzi — 58a84af

#### Manual

- [x] 1.7 Diff zawiera wyłącznie zmiany wyzwalaczy i wersji Node; joby pozostają równoległe — 58a84af

### Phase 2: Dokumentacja i kroki ręczne

#### Automated

- [x] 2.1 Dokumentacja nie wspomina `master` — b21d689
- [x] 2.2 `AGENTS.md` i `CLAUDE.md` mają identyczną treść — b21d689
- [x] 2.3 Formatowanie dokumentów przechodzi — b21d689

#### Manual

- [ ] 2.4 Push do `main` uruchamia oba joby i oba są zielone
- [ ] 2.5 Pull request do `main` uruchamia oba joby
- [ ] 2.6 Branch protection na `main` wymaga jobów `ci` i `smoke`
