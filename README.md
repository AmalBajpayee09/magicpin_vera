# VERA message engine

A deterministic, stateful implementation of the magicpin VERA HTTP challenge. The existing Express/TypeScript backend and React/Vite dashboard are retained. The outbound decision path now builds an evidence plan before rendering text; it can abstain. No API key or external model is required to run the bot.

## Run locally

Use Node 24.x (tested: 24.22.1) and Python 3.12+ for dataset generation and simulator tools. From this directory:

```powershell
npm.cmd ci
Copy-Item .env.example .env
python challenge_pack/dataset/generate_dataset.py --seed-dir challenge_pack/dataset --out challenge_pack/expanded
npm.cmd run verify
python scripts/verify_runtime.py
npm.cmd start
```

Edit `.env` to set your team name, comma-separated team members and contact email. The server binds `0.0.0.0:8080`; test it with `Invoke-RestMethod http://localhost:8080/v1/healthz`. It starts empty; context must be delivered by the judge. Stop with Ctrl+C. Detailed instructions: [Windows setup](docs/WINDOWS_SETUP.md).

## Contract and architecture

| Endpoint | Purpose |
|---|---|
| GET /v1/healthz | Liveness and singular scope counts |
| GET /v1/metadata | Identity, approach and version |
| POST /v1/context | Full versioned replacement, equal-version no-op, stale HTTP 409 |
| POST /v1/tick | Evidence-ranked actions, simulated `now`, max 20 |
| POST /v1/reply | Context-bound turns, cached retries, send/wait/end |
| POST /v1/teardown | Wipe test context and conversation state |

`src/api.ts` validates HTTP requests and commits state synchronously. `decision.ts` checks evidence, consent and category relationships; `composer.ts` renders an approved template structure. `replier.ts` handles conversations without claiming bookings or dispatches. `store.ts` persists atomic JSON snapshots before acknowledging a mutation. Run exactly **one process/instance** with a durable `STATE_FILE`; no external database or migration is needed. Teardown deletes application state after the test. Payload contents and credentials are not logged.

## Verification and deliverables

```powershell
npm.cmd test
npm.cmd run benchmark
npm.cmd run submission
python scripts/verify_official.py
python scripts/run_official_judge.py warmup
```

The final test report records actual results, including a production restart and clean-package check. The 30-pair benchmark is a **local invariant check, not an official score**. Scoring with the unchanged official simulator needs your separately configured LLM. See [test report](docs/TEST_REPORT.md), [initial audit](docs/AUDIT.md), [changelog](docs/CHANGELOG.md), [API examples](docs/API_EXAMPLES.md), and [deployment guide](docs/DEPLOYMENT.md).

## Limits and submission status

Public hosting and HTTPS are not verified. Connect your hosting account and deploy using `render.yaml`, then run the supplied live HTTP checker. The suggested persistent Render configuration is paid; approve its current cost in your account before creating it.

This is a rule-based engine, not a guarantee of hidden-judge quality. Unknown or insufficient signals are suppressed. The offline `submission.jsonl` has 30 records, including empty-body abstentions; the HTTP contract explicitly allows abstention, but the older static-file convention does not define it. Confirm portal treatment before uploading that file. There is no booking, WhatsApp, payment, listing-publication or campaign-dispatch integration. The optional local dashboard requires `ENABLE_DASHBOARD=true`; keep it off for public judging. Linux execution was tested; Windows instructions and Docker/Render configuration were reviewed but not executed here.
