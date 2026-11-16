# Observed verification report

Verified on 16 November 2026 in a Linux workspace, Node 24.22.1, npm 11.9.0 and Python 3.12.14. Source and official files were inspected before implementation changes. No official score, public URL or deployment success is claimed.

## Baseline and final comparison

| Check | Baseline observation | Final observed result |
|---|---|---|
| Dependency install | npm install --ignore-scripts succeeded; no original lockfile | New lockfile; clean npm ci verified in extraction run |
| TypeScript | Passed | Passed |
| Production build | Passed | Passed |
| Initial health | Loaded 5/50/200/100 fixtures; wrong plural keys | Empty state; correct singular keys |
| Metadata | team_members string; missing approach/submitted_at | Required fields and types verified through HTTP |
| Stale context | HTTP 200, accepted=true | HTTP 409, stale_version/current_version |
| Local benchmark | Self-reported 1500/1500 from internal heuristics | No self-grade; 30 pairs evaluated, 14 sends/16 abstentions |
| Automated tests | Legacy suite partially ran; external provider probes blocked | 44/44 top-level tests passed, zero skipped/failed |
| Official simulator | Original file exits 1: no LLM_API_KEY | Original file still exits 1; unchanged official warmup method separately passed |
| Process restart | State lost by design | Production process stopped/restarted; counts retained and duplicate tick suppressed |
| Official integrity | Not provided originally | 16 source files match supplied archive SHA-256 hashes |
| Python adapter | Broken/missing referenced module | Root bot.py invoked the same TypeScript composer successfully |
| Public deployment | None supplied | Not performed; Render connection/repository/billing action required |

The archive has 19 entries, including three directories; the integrity manifest correctly covers **16 files**. Official scoring logic and fixture originals were not edited.

## Commands executed

```text
npm install --ignore-scripts                          (baseline)
npm run lint
npm run build
node --import tsx scripts/run_benchmark.ts           (baseline heuristic)
python3 challenge_pack/dataset/generate_dataset.py --seed-dir challenge_pack/dataset --out challenge_pack/expanded
npm run verify
python3 scripts/verify_runtime.py
python3 scripts/verify_official.py
npm run submission
python3 challenge_pack/judge_simulator.py            (observed missing-key exit 1)
```

See `reports/final-verification.txt` for combined type/build/test/benchmark output, `production-runtime.json` for real production HTTP checks, `official-warmup.txt` for original warmup output, `official-scoring-attempt.txt` for the actual scoring prerequisite failure, `canonical-decisions.json` for each of the 30 decisions, and `python-adapter.txt` for the offline adapter check. The original tsx CLI attempted a restricted Unix IPC pipe; using `node --import tsx` avoids that requirement without changing business behavior.

## What the tests establish

The 44 tests include 200 generated unseen merchant/metric combinations, 100 placeholder cases, explicit unknown-evidence paths, fresh digest/version updates, malformed input, payload cap, per-recipient suppression, event expiry, action ranking/cap, ten concurrent ticks, consent scope/revocation, lifecycle distinctions, offer status/date/weekday checks, recall timing, pharmacy batch specificity, privacy-preserving refill copy, reply ownership, retry conflicts, customer booking restraint, auto-reply loops, negative/hostile/off-topic replies, changed intent, draft approval, opt-out, persistence rollback, teardown, and the gated dashboard demo. Iterations inside a test are not counted as separate top-level tests.

The canonical fixture set contains placeholders and even category-inappropriate generated customer triggers. Offline checks explicitly use **2026-04-26T10:30:00Z** and do not relax consent or fabricate missing evidence just to emit 30 messages. Recall reminders months before due are suppressed. This benchmark composes pairs independently; HTTP tests separately exercise stateful eligibility, expiry, suppression and action caps. `PASS` in the local canonical report means that composition returned a valid evidence-plan output or an intentional no-action; it does not measure the official five subjective dimensions.

## Measured local latency

One recorded production smoke run made 9 HTTP requests (all five required endpoints plus duplicate checks): mean **2.151 ms**, maximum **6.606 ms**. A separate paced test made 20 health requests at approximately 10 requests/second: mean **2.899 ms**, maximum **9.962 ms**. Raw measurements are in `reports/production-runtime.json` and `reports/final-verification.txt`. Values are local loopback measurements and vary by run; they do not establish public latency, TLS behavior or remote uptime. The clean-extraction run creates another independent measurement.

## Official simulator limits

The actual supplied simulator is LLM-based and hardcodes its provider configuration. It does not implement the promised deterministic 30-pair dry-run described in the user's summary. `scripts/run_official_judge.py` configures the imported original without editing it. Warmup uses a sentinel provider that raises if called; there are no model calls in warmup. Full scoring is **not verified** because no authorized provider credential was supplied. No fallback/mock scoring was substituted.

The old adversarial script's attempt to send dataset-derived context to Gemini was rejected by automatic approval review. That attempt was not retried. The final application and test suites perform no external LLM calls. The original scoring simulator remains available for you to run locally if you choose to authorize provider disclosure and costs.

## Clean package and remaining limits

The packaged source is verified by extracting to a new directory, installing from its own lockfile, running its own typecheck/build/tests/benchmark, and exercising its production server, official warmup and restart persistence. `reports/clean-verification.txt` and `reports/package-verification.json` record the initial clean-source verification. The final archive is then extracted and checked again before delivery. Every source/configuration file must match the verified clean source; transient dependencies and build output are excluded from the delivered ZIP.

Not verified: hidden judge scores, Windows-native execution, Docker image build/run, Render deployment, public HTTPS, public persistence and evaluation-window uptime. The deployment files and PowerShell instructions are supplied but are not evidence of deployment. The storage implementation is single-writer; do not run multiple processes/replicas against one snapshot. Provider-level backups require separate retention cleanup after the test.

The offline export contains 30 records, with 16 empty-body abstentions. Empty action lists are valid over HTTP; the old static submission format does not define abstention handling. Confirm this with the portal before submitting that file. All required HTTP behavior and the feasible local verification have been completed; public submission still depends on your hosting/account actions.
