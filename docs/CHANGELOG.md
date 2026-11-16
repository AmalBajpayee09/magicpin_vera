# Implementation changes

The Express/TypeScript runtime, Vite/React dashboard, original challenge materials and deterministic composition interface were preserved. The HTTP contract is unchanged externally except for corrections to required responses and validation. No external LLM is needed.

| File(s) | Previous issue | Modification | Reason |
|---|---|---|---|
| server.ts; new src/api.ts | Monolithic startup/routes, fixed port, open inspection APIs, weak HTTP validation | Separate testable app from startup; platform PORT/HOST, env loading, gated dashboard, structured errors | HTTP compatibility and isolated tests |
| new validation.ts | Required fields mostly unchecked | Validate scopes, identity links, versions, timestamps, nested types, safe key/depth/size limits | Malformed requests cannot poison stored context |
| store.ts | In-memory only; trigger updates clear suppression; stale version accepted | Atomic fsync/rename snapshots, request rollback, reply cache, opt-outs, event ledger, expiry records and teardown | Restart/retry correctness |
| types.ts | Missing consent/state/template fields | Add actual customer and action fields | Match supplied payloads |
| new decision.ts | Kind/keyword-driven default claims | Select evidence plan; purpose consent, fresh metrics, merchant offers and dates, scope/category gates, true no-action | Prevent invented operational facts |
| composer.ts; realization.ts | Default slots/deadlines, blind numeric deletion, 280-character CTA truncation | Render evidence plan with deterministic unique conversation ID and template; reject invalid output | Grounded complete messages |
| replier.ts | Fabricated bookings and dispatch, generic repeated confirmation, no replay protection | Deliver grounded draft, recognize intent change, wait/end rules, cached turns, identity checks | Useful multi-turn continuity without fictional side effects |
| categoryPolicy.ts | Useful category salutation rules | Retained and connected to composer | Preserve clinical greetings/category distinction |
| gemini.ts | Unbounded provider retries with only superficial grounding | Compatibility entry point delegates to deterministic composer; no API calls | Reproducibility and bounded response time |
| benchmark.ts; run_benchmark.ts | Heuristic self-assigned 1500/1500; benchmark overwrote submission | Report actual per-pair decisions/invariants with null rubric scores; export separately | Honest validation and isolation |
| scripts/generate_submission.ts; bot.py; compose_json.ts | Duplicate broken Python path; test data tied to global seed state | Working TypeScript export plus Python-to-Node compatibility adapter | Offline convention without duplicate decision engines |
| old actionSelector.ts, extractor.ts, facts.ts, ranking.ts, signals.ts, taxonomy.ts | Uncalled after replacing unsafe decisions; heuristic scoring, unsupported fallback claims | Removed after replacement and regression checks | Avoid shipping two contradictory decision engines |
| src/App.tsx; index.html | Official-score-looking local grades; synthetic replies to unknown conversations; external font request | Honest local-check labels, genuine gated demo conversations, local font fallbacks | Preserve dashboard utility without misleading scores |
| scripts/run_adversarial.ts | Tests mostly asserted non-empty text; external invalid-key probes | Local-only test launcher | Test decisions and semantics without disclosing context |
| tests/* | No meaningful HTTP/restart regressions | 44 top-level tests including generated adversarial cases, concurrency, consent, intent changes and persistence | Verify observed behavior |
| scripts/run_official_judge.py | Original simulator hardcodes globals | Configure globals in wrapper; original bytes unchanged; warmup sentinel forbids LLM calls | Repeatable official warmup, optional genuine scoring |
| scripts/smoke_api.py; verify_runtime.py | No clean public/production checks | Reusable five-endpoint live test; production process restart and warmup | Deployment readiness evidence |
| scripts/verify_official.py; docs/OFFICIAL_SHA256.json | No integrity check | Hash 16 originals | Prevent evaluation tampering |
| package*.json; .node-version | No lockfile; tsx CLI needs blocked IPC pipe in this environment | Reproducible lockfile; Node runtime range; node --import tsx scripts | Clean extraction/install and portable verification |
| .env.example; .gitignore | Unused API-key placeholders, no state exclusion | Minimal env configuration and state/cache exclusions | Clear setup and secret handling |
| Dockerfile; render.yaml; .dockerignore | Deployment files missing | Single-instance persistent service config and container recipe | Concrete deployable project |
| README.md; docs/* | Unsupported success guarantees, no beginner guide | Audit, actual evidence report, setup/API/deployment/checklist guides | Reviewable handoff |

Removed dependency: `@google/genai`. No runtime dependency was added. Transitive versions are pinned in the new npm lockfile. Official generator, seeds, category files, examples, briefs and simulator remain original. The former non-official Python `challenge_pack/generate_submission.py` imported a missing bot module and was removed in favor of the working root adapter/export.

Storage is intentionally one synchronous process with an atomic JSON snapshot. This is sufficient for the measured challenge workload; multiple replicas or large production datasets would require a shared transactional database and a different deployment design. Docker and public Render execution remain unverified.
