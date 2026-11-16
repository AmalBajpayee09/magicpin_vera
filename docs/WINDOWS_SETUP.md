# Windows, VS Code and PowerShell: complete setup

This guide runs the supplied project. No code needs to be written and no paid LLM is needed for the bot.

## 1. Install prerequisites

1. Install Node.js **24.x** from the [official downloads](https://nodejs.org/en/download/) or [24.x archive](https://nodejs.org/dist/latest-v24.x/). Choose the Windows x64 `.msi` installer for a normal Intel/AMD Windows PC. Keep npm and Add to PATH selected. The project was tested on 24.22.1; Node 26 has not been tested for this deliverable.
2. Install Python 3.12 or newer from [python.org](https://www.python.org/downloads/windows/). Enable Add Python to PATH if the installer offers it. Python is used for the official generator and HTTP verification, not the production server. No Python packages or virtual environment are needed: these tools use the standard library.
3. Use your existing [VS Code](https://code.visualstudio.com/Download). Git is only required later if deploying through a Git repository; [Git for Windows](https://git-scm.com/download/win) is its official installer.
4. Close and reopen VS Code after installation. In a PowerShell terminal, run:

```powershell
node --version
npm.cmd --version
python --version
```

Expected: Node `v24.x`, an npm version, and Python `3.12` or newer. If `python` opens the Microsoft Store, try `py --version` and use `py` in place of `python` below, or fix the Python PATH installation. No CUDA, Qt, compiler toolchain, Ollama, database server or Docker is needed for local execution.

## 2. Download, extract and open the project

Download `VERA_MAGICPIN_FINAL_SUBMISSION.zip` from this conversation to your Downloads folder. The ZIP contains one directory named `VERA_MAGICPIN_FINAL_SUBMISSION`.

Open PowerShell and run:

```powershell
New-Item -ItemType Directory -Force C:\Projects | Out-Null
Expand-Archive -LiteralPath "$HOME\Downloads\VERA_MAGICPIN_FINAL_SUBMISSION.zip" -DestinationPath C:\Projects
Set-Location C:\Projects\VERA_MAGICPIN_FINAL_SUBMISSION
Get-Location
Test-Path .\package.json
Test-Path .\server.ts
code .
```

Both `Test-Path` results must be `True`. If the download has a suffix such as `(1)`, use that actual ZIP filename. Extract to a fresh folder rather than overwriting a different version. In VS Code choose **Terminal → New Terminal**. Select PowerShell. Run `Get-Location`; it must show the folder containing `package.json`, not `C:\Projects` and not `src`.

## 3. Install dependencies and configure identity

From `C:\Projects\VERA_MAGICPIN_FINAL_SUBMISSION`:

```powershell
npm.cmd ci
Copy-Item .env.example .env
code .env
```

`npm ci` installs exactly the lockfile versions into `node_modules`. Wait for it to finish without an error. In `.env`, set:

```dotenv
TEAM_NAME=Your Team Name
TEAM_MEMBERS=Your Full Name,Another Member
CONTACT_EMAIL=your-real-contact@example.com
```

Replace these example values with your real submission identity. Set `SUBMITTED_AT` to your actual submission timestamp; obtain UTC with:

```powershell
(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
```

Save `.env`. Keep `PORT=8080`, `STATE_FILE=./data/state.json`, `PRELOAD_DATASET=false` and `ENABLE_DASHBOARD=false`. Keep `BOT_TOKEN` empty unless the challenge judge can send that token. `LLM_API_KEY` is unused by the bot and can stay blank. Do not commit `.env`.

Persistent storage is created automatically on the first successful state-changing request. There is no database installation, password, schema command or migration. The default snapshot is `data\state.json`; keep that file during a test so restarting the server restores state.

## 4. Generate and validate the official data

```powershell
python challenge_pack/dataset/generate_dataset.py --seed-dir challenge_pack/dataset --out challenge_pack/expanded
python scripts/verify_official.py
npm.cmd run verify
python scripts/verify_runtime.py
```

The generator reports **5 categories, 50 merchants, 200 customers and 100 triggers**; `test_pairs.json` contains 30 pairs. Integrity verification reports 16 original files matching byte-for-byte. `npm run verify` runs TypeScript checking, production build, all automated tests and 30-pair composition checks. The runtime script starts its own temporary production process, checks all official endpoints, runs the unchanged official warmup method, restarts the process and verifies state. It then stops its temporary server. Reports are written under `reports`.

A successful local check does not constitute an official LLM score. Check `docs\TEST_REPORT.md` for the observed handoff results and limitations.

## 5. Start the actual bot

```powershell
npm.cmd start
```

Leave this terminal open. Expected output includes a JSON line with `"event":"server_started"` and port `8080`. This runs `dist\server.cjs`, which was created in the previous build step.

Open a **second** PowerShell terminal in the same project directory:

```powershell
Invoke-RestMethod http://localhost:8080/v1/healthz | ConvertTo-Json -Depth 6
Invoke-RestMethod http://localhost:8080/v1/metadata | ConvertTo-Json -Depth 6
python scripts/smoke_api.py --url http://localhost:8080
```

Before any contexts have arrived, health counts are zero. The smoke script sends synthetic category/merchant/trigger contexts, calls tick, sends a reply and verifies retry suppression. Expected final status: `PASS`. It adds uniquely named `smoke-*` records and does not erase other state. HTTP request/response examples are in `docs\API_EXAMPLES.md`.

To stop the bot, click its terminal and press **Ctrl+C**. To restart, run `npm.cmd start` again in the same directory with the same `.env` and state path. A second copy must not run against the same state file.

## 6. Run individual checks

With the server stopped unless noted:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:api
npm.cmd run adversarial
npm.cmd test
npm.cmd run benchmark
npm.cmd run submission
python scripts/verify_runtime.py
```

The unit, API and adversarial suites create their own isolated state; they need no running main server. The canonical benchmark reads generated fixtures and records send/abstain decisions in `reports\canonical-decisions.json`. The submission export writes 30 offline records to `challenge_pack\submission.jsonl`. Some records intentionally have an empty body; check the submission caveat before uploading this legacy static export.

For official simulator **warmup**, keep your main bot running in its first terminal and run:

```powershell
$env:BOT_URL = "http://localhost:8080"
python scripts/run_official_judge.py warmup
```

This calls the original simulator's warmup implementation without an LLM. It checks health, metadata and sample context pushes. It is not a scored evaluation.

## 7. Optional official LLM scoring

The original official simulator contains hardcoded configuration and requires an LLM; simply setting BOT_URL and running its file is insufficient. Our wrapper configures its globals without editing the original file. Scoring sends synthetic challenge context to the LLM provider you choose and may incur charges.

If you choose to run it locally, set a provider/model supported by the unchanged simulator and your account. Enter your key privately in your own terminal, never in this chat or in source code:

```powershell
$env:BOT_URL = "http://localhost:8080"
$env:LLM_PROVIDER = "openai"
# Set LLM_MODEL to a model your account supports, or leave it blank for the supplied simulator default.
$env:LLM_MODEL = ""
$secret = Read-Host "Your provider API key" -AsSecureString
$credential = New-Object System.Net.NetworkCredential("", $secret)
$env:LLM_API_KEY = $credential.Password
python scripts/run_official_judge.py all
Remove-Item Env:LLM_API_KEY
Remove-Variable credential, secret
```

The wrapper uses **process environment variables** for these settings; it does not read the application's `.env`. The official simulator uses wall time, whereas supplied triggers have April/November expiry dates. Past events may therefore be correctly suppressed. Do not disable production expiry just to make the simulator print more messages. For reproducible composition checks use the fixed-time local benchmark; for live scenarios use fresh contexts. No official score was obtained during this handoff.

## 8. Optional local dashboard

Stop the main server. In `.env`, set `ENABLE_DASHBOARD=true` and `PRELOAD_DATASET=true`, then run `npm.cmd start`. Open `http://localhost:8080`. The retained dashboard inspects contexts, local checks and conversational demos. A demo uses a synthetic conversation; it does not dispatch messages. These options expose context inspection and should stay **false on public judging deployments**. Restore both settings to false before deployment. To remove preloaded demo contexts, use teardown after stopping other activity (see next section).

## 9. End-of-test cleanup

After the evaluation has ended and you are ready to remove **all** its saved application context:

```powershell
Invoke-RestMethod -Uri http://localhost:8080/v1/teardown -Method Post -ContentType "application/json" -Body '{}'
Invoke-RestMethod http://localhost:8080/v1/healthz | ConvertTo-Json -Depth 6
```

Counts should return to zero. This intentionally clears all conversations, contexts, opt-outs and reply caches. Do not run it during a scored test. If the server is stopped, deleting `data\state.json` also resets state at next startup; keep runtime data out of the repository.

## 10. Troubleshooting

| Symptom | Fix for this project |
|---|---|
| `node` or `npm` not recognized | Reopen VS Code after installing Node; run `where.exe node`; repair PATH if no result |
| `npm.ps1 cannot be loaded` | Use `npm.cmd` as shown; no execution-policy change is necessary |
| `python` not recognized | Try `py`; install Python and enable PATH, then reopen terminal |
| `ENOENT package.json` | `Set-Location C:\Projects\VERA_MAGICPIN_FINAL_SUBMISSION`; verify `Test-Path package.json` |
| `Cannot find module` | Run `npm.cmd ci` from the project root; do not copy node_modules from another OS |
| `dist/server.cjs` missing | Run `npm.cmd run build` before `npm.cmd start` |
| Port 8080 is in use | Stop the old bot; inspect `Get-NetTCPConnection -LocalPort 8080`; alternatively set PORT=8081 in `.env` and use that port in all URLs |
| Startup fails / state parse error | Verify STATE_FILE directory is writable and file is valid JSON. Preserve a local copy for diagnosis; only reset it if losing that test state is acceptable |
| `internal_error` on context | State snapshot could not be saved; check directory permissions and available disk. The request is rolled back, so fix storage and retry |
| Context HTTP 400 | Use official field names, matching IDs, integer version, object payload, ISO timestamp with timezone; inspect the response reason |
| Context HTTP 409 | A higher version exists; do not overwrite with older context. Use the current or a genuinely newer version |
| Tick returns no actions | Check expiry against tick.now, available trigger IDs, consent, category/merchant links and prior suppression. No-action can be correct |
| Reply HTTP 404 | Use a conversation_id returned by a prior tick; arbitrary IDs cannot start a reply conversation |
| Reply HTTP 409 | Check merchant/customer identity, sender role, turn ordering and repeated-turn payload consistency |
| HTTP 401 | BOT_TOKEN is set. Include the matching Authorization header or unset it if the judge does not support auth |
| Official simulator asks for API key | Warmup needs none through our wrapper; scoring requires your provider environment variables |
| Cloud build says `vite` or `esbuild` missing | Use `npm ci --include=dev` during the build stage |
| Public URL times out | Verify Node Web Service type, host=0.0.0.0, platform PORT and service logs; follow DEPLOYMENT.md |
| Context disappears after hosting restart | Mount the persistent disk and set STATE_FILE inside it; do not run multiple replicas |

For deployment, continue with [DEPLOYMENT.md](DEPLOYMENT.md). Linux commands were executed during verification; the Windows/PowerShell guide itself was reviewed, not executed on a Windows machine here.
