# From localhost to a verified public base URL

## Current status

No public service has been created or verified in this session. Local production startup, all five endpoints, official warmup and restart persistence were tested. A Render integration is available but not connected to your account. Account authorization, repository access and acceptance of hosting charges are the remaining deployment-dependent steps. Never paste passwords or private tokens into chat.

## Primary hosting choice

Use a **Render Node Web Service with one paid instance and an attached persistent disk**. This matches Express and the snapshot store with little operational setup. The project includes a `render.yaml` Blueprint. Review the current Starter and disk cost in Render before accepting creation. Do not select Static Site: this application is a stateful HTTP backend. A free sleeping service without a disk does not meet this project's restart-recovery requirement.

Official references checked for this handoff:

* [Deploy a Node Express app](https://render.com/docs/deploy-node-express-app)
* [Persistent disks](https://render.com/docs/disks)
* [Health checks](https://render.com/docs/health-checks)
* [Blueprint reference](https://render.com/docs/blueprint-spec)
* [Node version configuration](https://render.com/docs/node-version)

Only the disk mount survives restarts/redeploys. A disk is accessible to a single instance; it prevents zero-downtime deploys. Do not redeploy during a scored session. Set `autoDeployTrigger: off` as included in the Blueprint. Normal health checks do not write business state or require an LLM.

## 1. Prepare the repository

Install [Git for Windows](https://git-scm.com/download/win) if needed. From the extracted project root in PowerShell:

```powershell
git --version
git init
git branch -M main
git add .
git status --short
git check-ignore .env data/state.json node_modules
```

Check the staging list: `.env`, `data`, `node_modules` and `dist` must not appear. `.env.example` should appear. Do not add provider keys or runtime state. Then:

```powershell
git commit -m "Implement verified VERA challenge HTTP service"
```

Sign in at [GitHub](https://github.com/) in your own browser. Create a **private** empty repository called `vera-message-engine`. Do not initialize it with another README. Copy its actual HTTPS URL. Replace the example below with that copied URL:

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/vera-message-engine.git
git push -u origin main
```

Git Credential Manager may open a browser to authenticate. Use that flow; do not place an access token in the command or remote URL. If `origin` already exists, use `git remote -v` to inspect it before changing anything.

## 2. Authorize Render and create the service

Connect the Render integration in ChatGPT if you want assistance deploying here. Otherwise sign in directly to [Render](https://dashboard.render.com/), create/select your workspace, and authorize access to this repository.

Use **New → Blueprint** and select the repository containing `render.yaml`. Review the proposed service and disk, then enter your team identity values when prompted. Approve the current charges yourself. The intended configuration is:

| Setting | Value |
|---|---|
| Service type | Web Service |
| Runtime | Node |
| Node version | 24.22.1 |
| Build | `npm ci --include=dev && npm run lint && npm run build` |
| Start | `npm start` |
| Host | `0.0.0.0` |
| Port | Use Render's injected `PORT`; the server reads it |
| Health check | `/v1/healthz` |
| Instances | Exactly 1 |
| Disk mount | `/var/data` |
| State file | `/var/data/state.json` |
| Disk size | 1 GB as configured; review cost before creation |
| Auto-deploy | Off during evaluation |
| PRELOAD_DATASET | `false` |
| ENABLE_DASHBOARD | `false` |
| NODE_ENV | `production` |

If creating a Web Service manually, enter the same values and attach the disk under advanced settings. No managed database is required. No initialization or migration command is needed: the application creates the snapshot directory/file when it accepts its first context.

Set `TEAM_NAME`, `TEAM_MEMBERS` (comma-separated), `CONTACT_EMAIL` and `SUBMITTED_AT` to your real submission values. No model API key is required by this bot. Leave `BOT_TOKEN` unset unless the judge supports it. Optional official scoring credentials belong in your **local scoring terminal**, not in the bot's hosting settings.

## 3. Build, deploy and copy the real URL

Create/deploy the service after reviewing the configuration. Wait for logs to show that the dependency installation and build succeeded, followed by `server_started`. The service page supplies its actual HTTPS `onrender.com` URL. Copy that URL. No example hostname in this guide is a deployed service.

If your service is marked Live but its health check fails, read its logs and confirm build/start commands, `PORT` and host binding. A successful hosting notification alone does not verify API compatibility.

## 4. Verify all public endpoints

Keep the local project open. In PowerShell, replace the example with the real copied URL:

```powershell
$base = "https://YOUR-ACTUAL-SERVICE.onrender.com"
Invoke-RestMethod "$base/v1/healthz" | ConvertTo-Json -Depth 6
Invoke-RestMethod "$base/v1/metadata" | ConvertTo-Json -Depth 6
python scripts/smoke_api.py --url $base
```

Expected final status from the script: `PASS` and `https: true`. It exercises health, metadata, context, tick, reply, duplicate reply and duplicate tick. It also prints mean and maximum response times. These are actual measured HTTP values when you run it; they have not been measured publicly during this handoff.

The smoke script inserts uniquely named synthetic records. Do not run the full adversarial suite against a judged live service; those tests run their own local isolated servers. Before the actual judge warmup, remove smoke/demo state with teardown **only when no test is running**:

```powershell
Invoke-RestMethod -Uri "$base/v1/teardown" -Method Post -ContentType "application/json" -Body '{}'
Invoke-RestMethod "$base/v1/healthz" | ConvertTo-Json -Depth 6
```

Counts should all be zero. The judge will deliver the real starting contexts.

## 5. Verify restart persistence before clearing smoke data

Perform this before the cleanup above:

1. Run the live smoke script and retain its unique `synthetic_context_id` and `conversation_id`.
2. Request health and retain its context counts.
3. Restart the service from Render's controls without changing disk configuration.
4. Re-request health: counts must remain unchanged.
5. Use the printed smoke context ID in another tick. It must not resend the action:

```powershell
$tid = "PASTE-THE-SMOKE-CONTEXT-ID"
$body = @{
  now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  available_triggers = @($tid)
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri "$base/v1/tick" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
```

Expected: `actions` is empty. Then perform the explicit teardown above so the judge sees a clean service. If counts vanish, fix the mounted disk/state path before submitting.

## 6. Submission

Submit the **base URL**, for example the actual copied `https://...onrender.com`, without `/v1/tick` appended. Verify that metadata identifies your team, not Candidate. Keep the service running through the test window and avoid restarts/deploys. Watch logs for `request_failed` and hosting resource exhaustion.

The main brief also mentions a Python composer and 30-line static file. This project includes `bot.py` as a Node-backed compatibility adapter and an offline export. The HTTP testing brief is the primary runtime contract. Ask the portal/organizer to confirm how its static-file route treats abstentions before uploading empty message records. Do not replace restraint with fabricated messages to fill the file.

After the event, call teardown and clear any application-data backups according to the organizer's retention rule. Hosting providers may keep their own disk backups; do not retain test payloads beyond the permitted period.

## Optional container deployment

If you already have a container host, the included Dockerfile builds the same service. Docker itself was unavailable in this session, so this image has not been built or run here:

```powershell
docker build -t vera-message-engine .
docker volume create vera-data
docker run --rm --name vera -p 8080:8080 --env-file .env -e STATE_FILE=/app/data/state.json -v vera-data:/app/data vera-message-engine
```

The volume must be writable by the container's node user. Keep exactly one instance. The same live smoke checks apply. No second provider is needed for the primary path.
