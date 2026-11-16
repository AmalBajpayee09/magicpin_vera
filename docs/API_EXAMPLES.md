# API examples and response contracts

These examples use the official request field names with synthetic IDs. Detailed canonical contexts and exchanges remain unchanged in `challenge_pack/examples/api-call-examples.md`. Run the local server first.

## PowerShell: category, merchant and trigger

```powershell
$base = "http://localhost:8080"
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$expiry = (Get-Date).ToUniversalTime().AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
$contexts = @(
  @{ scope="category"; context_id="restaurants"; version=1; delivered_at=$now;
     payload=@{slug="restaurants";voice=@{tone="warm, practical"}} },
  @{ scope="merchant"; context_id="demo-cafe"; version=1; delivered_at=$now;
     payload=@{merchant_id="demo-cafe";category_slug="restaurants";identity=@{name="Demo Cafe";languages=@("en")};offers=@()} },
  @{ scope="trigger"; context_id="demo-plan"; version=1; delivered_at=$now;
     payload=@{id="demo-plan";scope="merchant";kind="active_planning_intent";merchant_id="demo-cafe";customer_id=$null;
       payload=@{intent_topic="corporate_bulk_lunch"};urgency=4;suppression_key="demo-plan";expires_at=$expiry} }
)
foreach ($context in $contexts) {
  Invoke-RestMethod -Uri "$base/v1/context" -Method Post -ContentType "application/json" -Body ($context | ConvertTo-Json -Depth 12)
}
$tick = @{now=$now;available_triggers=@("demo-plan")} | ConvertTo-Json
$result = Invoke-RestMethod -Uri "$base/v1/tick" -Method Post -ContentType "application/json" -Body $tick
$result | ConvertTo-Json -Depth 12
```

Context success contains `accepted`, `ack_id`, `stored_at`. Resending the same version is a successful no-op. Sending a lower version returns **409** with `accepted:false`, `reason:"stale_version"`, and `current_version`. A higher version replaces the complete payload rather than merging it.

A tick response contains only `actions`. Each action includes conversation/merchant/customer/trigger IDs, send_as, template_name, template_params, body, cta, suppression_key and rationale. The template registry is `templates.json`: `{{1}} {{2}} {{3}}`. These are illustrative challenge templates, not actual approved Meta templates. The first message uses them; replies are free-form. No message is dispatched to WhatsApp.

For the demo input, the generated body is:

> Demo Cafe, Continuing your corporate bulk lunch plan. Proposed outline: menu, order minimum, delivery window and billing terms; pricing needs your approval. Shall I draft the announcement for review?

This is an illustrative deterministic output; the actual production smoke HTTP result is recorded separately under `reports`.

## PowerShell: reply using the actual conversation

```powershell
$action = $result.actions[0]
$reply = @{
  conversation_id = $action.conversation_id
  merchant_id = $action.merchant_id
  customer_id = $action.customer_id
  from_role = "merchant"
  message = "ok let's do it"
  received_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  turn_number = 2
} | ConvertTo-Json
Invoke-RestMethod -Uri "$base/v1/reply" -Method Post -ContentType "application/json" -Body $reply | ConvertTo-Json -Depth 8
```

A reply returns `action:"send"` plus body/cta/rationale, `action:"wait"` plus wait_seconds/rationale, or `action:"end"` plus rationale. Exact duplicate turns replay the cached response; conflicting payloads for the same turn return 409. Unknown conversation IDs return 404. Merchant/customer ownership and sender role must match the original action. Do not generate your own conversation ID for a reply.

## Operational behavior

* Maximum JSON request size: 500 KiB (500 × 1024 bytes); oversize returns JSON 413.
* Invalid JSON returns JSON 400. Unknown API routes return JSON 404.
* Tick requires an ISO timestamp including timezone and a string array of available trigger IDs.
* At most 20 actions; one best candidate per recipient in each tick. Unsent candidates remain eligible.
* Trigger expiry is checked against `tick.now`, not the machine clock. Offline canonical checks explicitly use 2026-04-26T10:30:00Z; reply checks use `received_at`.
* Customer triggers require a matching customer/merchant relationship, WhatsApp channel, non-revoked opt-in and an allowed purpose. Current scopes are mapped explicitly in `decision.ts`; unknown customer purposes are suppressed.
* Opt-out suppresses future proactive contact to that recipient. A refusal ends the current proposal. No booking or campaign execution is fabricated.
* GET health/metadata do not mutate state. POST teardown wipes all state; use only after the test.
* Optional BOT_TOKEN applies to POST routes. If configured, send `Authorization: Bearer <your value>`; normally leave unset for the official judge.
