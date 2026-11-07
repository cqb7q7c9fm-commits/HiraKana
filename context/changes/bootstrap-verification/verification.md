---
bootstrapped_at: 2026-11-07T00:35:14Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: hirakana
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: hirakana
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Samodzielna osoba buduje w około 3 tygodnie po godzinach aplikację webową dla garstki użytkowników, z logowaniem i zapisem wyników na koncie. To pasuje do rekomendowanego domyślnego startera dla aplikacji webowej w JavaScript/TypeScript: 10x Astro Starter dostarcza gotowe logowanie, bazę danych i wdrożenie na brzegu sieci, a wszystkie cztery kryteria przyjazności dla agentów są spełnione. Pewność bootstrappera to first-class, więc możliwe są pojedyncze ręczne kroki. Płatności, realtime, AI i zadania w tle są poza zakresem. CI działa na GitHub Actions z automatycznym wdrożeniem po merge do main.

## Pre-scaffold verification

| Signal      | Value                                                  | Severity | Notes                                      |
| ----------- | ------------------------------------------------------ | -------- | ------------------------------------------ |
| npm package | not run                                                | n/a      | cmd_template starts with `git clone`       |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-10-29   | fresh    | from card.docs_url                         |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0 (clone i `npm install` zakończone; 638 pakietów dodanych, katalog node_modules obecny)
**Files moved**: 22 wpisów najwyższego poziomu (w tym node_modules)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (absent in cwd)
**.bootstrap-scaffold cleanup**: deleted (po usunięciu sklonowanego `.git/`)

Uwaga: starter dostarcza własne `AGENTS.md` i `CLAUDE.md`; w katalogu nie było wcześniej takich plików, więc zostały przeniesione bez zmian. `context/` zachowany, scaffold nie zawierał `context/`.

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 0 HIGH, 13 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/6/0 direct of total 0/0/13/0

#### MODERATE findings

Wszystkie w łańcuchu narzędzi lintowania; jedyna przyczyna źródłowa to podatność w `minimatch` (potencjalny DoS przez amplifikację globparts), propagowana przez:

- bezpośrednie: eslint, @eslint/js, typescript-eslint, eslint-plugin-astro, eslint-plugin-jsx-a11y, eslint-plugin-react
- przechodnie: @eslint/config-array, @typescript-eslint/eslint-plugin, parser, type-utils, typescript-estree, utils, minimatch

## Hints recorded but not acted on

| Hint                    | Value               |
| ----------------------- | ------------------- |
| bootstrapper_confidence | first-class         |
| quality_override        | false               |
| path_taken              | standard            |
| self_check_answers      | null                |
| team_size               | solo                |
| deployment_target       | cloudflare-pages    |
| ci_provider             | github-actions      |
| ci_default_flow         | auto-deploy-on-merge|
| has_auth                | true                |
| has_payments            | false               |
| has_realtime            | false               |
| has_ai                  | false               |
| has_background_jobs     | false               |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
