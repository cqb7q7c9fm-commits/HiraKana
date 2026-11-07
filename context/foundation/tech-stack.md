---
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
---

## Why this stack

Samodzielna osoba buduje w około 3 tygodnie po godzinach aplikację webową dla garstki użytkowników, z logowaniem i zapisem wyników na koncie. To pasuje do rekomendowanego domyślnego startera dla aplikacji webowej w JavaScript/TypeScript: 10x Astro Starter dostarcza gotowe logowanie, bazę danych i wdrożenie na brzegu sieci, a wszystkie cztery kryteria przyjazności dla agentów (typy, konwencje, popularność, dokumentacja) są spełnione. Pewność bootstrappera to first-class, więc możliwe są pojedyncze ręczne kroki przy tworzeniu szkieletu. Płatności, realtime, AI i zadania w tle są poza zakresem. CI działa na GitHub Actions z automatycznym wdrożeniem po merge do main, czyli tak, jak starter jest dostarczany.
