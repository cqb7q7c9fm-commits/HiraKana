---
project: hirakana
researched_at: 2026-11-07
recommended_platform: Cloudflare Workers (Static Assets)
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 (SSR) + React 19 + Supabase auth
  runtime: Cloudflare workerd (@astrojs/cloudflare 14.x)
---

## Recommendation

**Deploy on Cloudflare Workers (Static Assets).**

Adapter `@astrojs/cloudflare` 14 i `wrangler.jsonc` są już w repo, więc to ścieżka najmniejszego oporu. Darmowy plan pokrywa skalę „garstki użytkowników” (priorytet: minimalny koszt), użytkownik zna platformę, a `wrangler` daje pełną pętlę deploy / rollback / logi z CLI. Wszystkie pięć kryteriów przyjazności dla agentów dostaje Pass.

Uwaga: `tech-stack.md` wspomina „cloudflare-pages”, ale adapter od v13 **nie wspiera już Pages**. Docelowo to Workers + Static Assets.

Odpowiedzi z wywiadu: trwałe połączenia — nie (poprawione po doprecyzowaniu), priorytet koszt, znajomość Cloudflare, jeden region, zewnętrzni dostawcy w porządku (Supabase).

## Platform Comparison

| Platforma | CLI-first | Managed | Docs dla agenta | Stabilne API deployu | MCP | Uwagi |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | Darmowy plan, adapter już w repo |
| Netlify | Pass | Pass | Pass | Pass | Pass | 300 kredytów/mies., twardy limit |
| Vercel | Pass | Pass | Pass | Pass | Partial | Hobby tylko niekomercyjnie; MCP beta |
| Railway | Pass | Pass | Partial | Pass | Pass | Od ok. $5/mies. |
| Render | Partial | Pass | Pass | Pass | Partial | Darmowy plan usypia po 15 min (cold start ok. 1 min) |
| Fly.io | Pass | Partial | Pass | Pass | Partial | Brak darmowego planu dla nowych kont; kontenery to nadmiar |

Źródła cenowe to głównie blogi trzecie (stan na 2026-11-07); przed budżetowaniem zweryfikuj oficjalne strony cenowe.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Najlepsze dopasowanie do stosu (adapter, workerd w `astro dev`/`preview`), najniższy koszt, brak cold startu, znajomość użytkownika, oficjalne MCP i `llms.txt` w dokumentacji.

#### 2. Netlify

Darmowy plan i oficjalny MCP Server, pierwszorzędna obsługa Astro SSR. Słabsze: twardy limit kredytów (projekt pauzuje po przekroczeniu), brak znajomości po stronie użytkownika, konieczna zmiana adaptera.

#### 3. Vercel

Dobre DX i CLI. Słabsze: plan Hobby wyklucza użycie komercyjne, MCP w becie, zmiana adaptera.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. `tech-stack.md` mówi „cloudflare-pages”, a adapter nie wspiera już Pages; tutoriale o Pages będą mylące.
2. Limit CPU na darmowym planie jest mały (źródła podają 10 ms lub 30 ms, niespójnie); SSR + wywołania Supabase mogą go przekraczać.
3. Baza (Supabase) jest poza Cloudflare, więc każde żądanie SSR ma dodatkowy przeskok sieciowy.
4. workerd to nie Node: biblioteki zależne od Node API lub CommonJS mogą zawieść dopiero po deployu.
5. Rollback cofa tylko kod; migracje Supabase nie cofają się automatycznie.

### Pre-Mortem — How This Could Fail

MVP działało lokalnie i na preview. Po wdrożeniu część zapytań przekraczała limit CPU na darmowym planie, co wymusiło płatny plan ($5/mies.) wbrew założeniu „minimalizuj koszt”. Sesje zapisywane w KV (`SESSION`) nie były skonfigurowane na produkcji i użytkownicy wylogowywali się losowo. Sekrety `SUPABASE_URL` i `SUPABASE_KEY` ustawiono tylko w GitHubie, a nie w Workers, więc build przechodził, ale runtime nie miał kluczy. Zespół tracił czas na poradniki o Pages. Deploy nie był częścią CI, więc nikt nie zauważył rozjazdu między `main` a produkcją; ktoś wdrożył z lokalnej maszyny z innego brancha. Rollback cofnął kod, ale nie schemat bazy, i aplikacja zwracała błędy.

### Unknown Unknowns

- Adapter 14 + Astro 7: `astro dev` i `astro preview` już działają na workerd, więc osobny `wrangler dev` jest zbędny. Env czyta się przez `cloudflare:workers` lub `astro:env`; `Astro.locals.runtime` usunięto.
- Domyślny binding KV `SESSION` jest potrzebny sesjom Astro; bez niego (lub bez `session: false`) deploy może się nie powieść.
- Środowisko wybiera się w czasie builda (`CLOUDFLARE_ENV=… astro build && wrangler deploy`), nie przy deployu.
- Nazwa Workera w `wrangler.jsonc` to nadal `10x-astro-starter`; od niej zależy URL `*.workers.dev`.
- Retencja logów Workers to ok. 3 dni (darmowy plan); zakres oficjalnego MCP Cloudflare (głównie odczyt) jest niepotwierdzony.
- Limity i ceny pochodzą z blogów trzecich; zweryfikuj w oficjalnej dokumentacji.

## Operational Story

- **Preview deploys**: `wrangler versions upload` tworzy wersję z podglądowym URL bez promowania na produkcję. Wymaga skonfigurowania w CI (obecnie deploy nie jest częścią CI). Podgląd jest publiczny, chyba że dodasz Cloudflare Access.
- **Secrets**: Produkcja: `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (Workers Secrets). Lokalnie: `.dev.vars` (gitignored). Token Cloudflare dla CI w GitHub Secrets. Rotacja: ponowne `secret put` + nowy deploy; klucz Supabase rotuje się w panelu Supabase.
- **Rollback**: `npx wrangler rollback` (do jednej z ostatnich wersji) lub przez panel Deployments; czas rzędu sekund. Nie cofa bazy ani bindingów (KV, Supabase) — migracje projektuj wstecznie kompatybilnie. Składnię potwierdź w `wrangler rollback --help` dla 4.156.
- **Approval**: Człowiek: deploy na produkcję, rotacja sekretów, zmiany w migracjach/RLS Supabase, usuwanie zasobów. Agent może bez nadzoru: build, lint, smoke, `versions upload` (podgląd).
- **Logs**: `npx wrangler tail` (na żywo); `observability.enabled` jest już w `wrangler.jsonc` (Workers Logs w panelu). Opcjonalnie oficjalny Cloudflare MCP do odczytu logów/obserwowalności (zakres do potwierdzenia).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `tech-stack.md` wskazuje Pages, adapter wspiera tylko Workers | Unknown unknowns | H | M | Zaktualizuj `tech-stack.md` (deployment_target), używaj dokumentacji Workers |
| Limit CPU na darmowym planie przekroczony przez SSR | Devil's advocate | M | M | Mierz CPU po pierwszym deployu; prerender stron statycznych; budżet $5/mies. jako plan B |
| Brak bindingu KV `SESSION` na produkcji | Pre-mortem | M | H | Utwórz namespace KV i dodaj binding w `wrangler.jsonc` albo ustaw `session: false` |
| Sekrety nie ustawione w Workers | Pre-mortem | M | H | `wrangler secret put` przed pierwszym deployem; smoke test na URL produkcji |
| Rollback nie cofa schematu Supabase | Devil's advocate | M | H | Migracje wstecznie kompatybilne (expand/contract); backup przed migracją |
| Deploy poza CI z dowolnego brancha | Pre-mortem | M | M | Dodaj job deployu na `main` (token w GitHub Secrets); zakaz ręcznego deployu |
| Biblioteka niezgodna z workerd | Devil's advocate | L | M | `astro dev`/`preview` już używają workerd — testuj tam, nie w Node |
| Latencja Workers ↔ Supabase | Devil's advocate | L | L | Wybierz region Supabase blisko użytkowników (jeden region) |
| Niezweryfikowane limity i ceny (blogi trzecie) | Research finding | M | M | Sprawdź oficjalną stronę limitów Workers przed startem |
| Retencja logów ok. 3 dni | Unknown unknowns | M | L | Sprawdzaj logi po deployu; rozważ eksport (Logpush) dopiero po MVP |

## Getting Started

Zweryfikowano względem `astro@^7.4.4`, `@astrojs/cloudflare@^14.4.3`, `wrangler@^4.156`.

1. Zaloguj się: `npx wrangler login` (lub `CLOUDFLARE_API_TOKEN` w CI).
2. Zmień `name` w `wrangler.jsonc` z `10x-astro-starter` na `hirakana`; zdecyduj o `SESSION` KV (utwórz namespace i binding albo `session: false`).
3. Ustaw sekrety: `npx wrangler secret put SUPABASE_URL` oraz `npx wrangler secret put SUPABASE_KEY` (wartości z produkcyjnego projektu Supabase).
4. Lokalnie testuj przez `npm run dev` / `npm run preview` (już workerd); osobny `wrangler dev` nie jest potrzebny.
5. Wdróż: `npm run build && npx wrangler deploy`, następnie `BASE_URL=<url> npm run smoke`. Zaktualizuj `tech-stack.md` (Pages → Workers).

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
