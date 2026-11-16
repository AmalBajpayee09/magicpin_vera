# Initial audit and requirements matrix

Audited the uploaded TypeScript/Express project and the separate official ZIP before changing source. Baseline executed on Node 24.22.1 / Python 3.12.14. Raw baseline output is in `reports/baseline-*`.

| Component | Initial status | Official requirement | Observed issue | Action |
|---|---|---|---|---|
| Build/typecheck | PASS | Runnable implementation | Both passed | Preserve React/Vite/Express stack |
| Context ingestion | PARTIAL | Same version no-op; newer atomic replacement; older HTTP 409 | Older version returns accepted=true/200; missing stored_at; weak validation | Correct HTTP schema; validate inputs |
| Health | FAIL | Singular category/merchant/customer/trigger counts; initially empty | Plural keys; preloads 355 fixture entities | Empty production state; explicit demo preload |
| Metadata | FAIL | team_members array, approach, submitted_at | Wrong type; missing fields; hardcoded identity | Environment-based metadata |
| Tick | PARTIAL | At most 20 actions; simulated time; unique conversation IDs | No cap, expiry/consent checks, ranking across candidates, or true no-action path | Eligibility gates; rank before sending |
| Decision/composition | PARTIAL | Evidence-backed, category-aware, fresh context | Useful extraction/policies exist, but defaults invent 8 slots, 24h deadlines, offers and demand; deletes numbers instead of rejecting claims | Preserve interfaces and useful extraction; replace unsafe realization with evidence plans |
| Customer handling | FAIL | Match merchant, purpose-specific consent, sender attribution | Consent/state missing from types and unchecked | Explicit scope mapping and lifecycle rules |
| Offers | PARTIAL | Merchant activation and validity required | Some paths take first offer or category catalog as available | Filter status/dates/weekday restrictions |
| Reply | FAIL | Contextual multi-turn; no fabricated side effects | Unverified slot confirmation; repeated generic draft; no replay cache; merchant/customer confusion | Retain loop/intent approach; bind identities and cache turns |
| Suppression | PARTIAL | Per recipient/event dedup | Global keys can suppress different merchants; new trigger version clears suppression | Scope keys; event ledger; expiry; opt-outs |
| Persistence | FAIL | User additionally requests restart recovery | In-memory only; optional official teardown absent | Atomic JSON snapshots, single writer, teardown |
| Tests/reporting | PARTIAL | Actual official and adversarial checks | Self-grades 1500/1500 with near-default tens; tests equate non-empty with correct | Separate invariant checks from LLM scores |
| Packaging | FAIL | Clean dependency install, lockfile, reproducible ZIP | No lockfile/Docker/Windows guide | Add and clean-extract verify |
| Public deployment | UNVERIFIED | Public base URL, all endpoints checked | No deployment account/URL supplied | Deployment configuration and guide; account-dependent |

## Contract precedence and contradictions

* `challenge-testing-brief.md` §2 and `examples/api-call-examples.md` govern HTTP. The brief's tiny Python skeleton disagrees with its normative 409/idempotency rules; follow the normative prose, accepting equal versions and rejecting lower ones.
* HTTP runtime is language-neutral despite the main brief's suggested `bot.py` artifact. Retain TypeScript, plus a Python composition adapter for the older offline submission convention.
* The actual official `judge_simulator.py` needs an LLM and hardcodes its configuration. It is not a deterministic 30-pair scorer and does not read BOT_URL from the environment. Preserve its bytes; load it in a wrapper that assigns documented configuration globals before calling it.
* The official simulator uses wall time, while the dataset has mixed April/November timestamps. Canonical offline composition and HTTP tests specify their own scenario time; production honors `/v1/tick.now` and never disables expiry just for the simulator.
* The main brief permits valuable grounded URLs and has no hard body cap. The old engine forbids URLs and truncates at 280 characters. Remove the arbitrary truncation; keep one CTA.
* Official memory persistence is allowed for a test. The user requests restart recovery, so add one-process durable snapshots; multiple workers/replicas require a different database.
* Official privacy requires deleting context after the test. Implement `/v1/teardown` to clear memory and the snapshot. Do not commit runtime state.

## Baseline evidence

`npm install --ignore-scripts`, TypeScript check, and production build succeeded. CLI `tsx` failed on the environment's Unix pipe restriction; direct `node --import tsx` succeeded and will be used in scripts. The legacy benchmark reported 1500/1500 in 17 ms; this is an internal heuristic, not an official or independently judged result. Baseline HTTP output confirms schema/version problems. Official simulator execution exits 1 because LLM_API_KEY is unset. The old adversarial runner's external Gemini probe was blocked by automatic approval review; replace it with local deterministic tests, without retrying that disclosure.
