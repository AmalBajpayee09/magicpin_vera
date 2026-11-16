# Final handoff checklist

## Verified locally

- [x] Existing codebase audited; initial evidence retained.
- [x] Working Express/TypeScript/Vite architecture and useful dashboard retained.
- [x] Incorrect HTTP response schemas and stale-version behavior corrected.
- [x] All five official endpoints implemented and exercised.
- [x] Official dataset generated: 5 / 50 / 200 / 100 entities and 30 pairs.
- [x] New IDs, updated digest and metric contexts exercised.
- [x] Consent, category restrictions, offers and expiry tested.
- [x] Reply ownership, duplicate turns, changed intent and multi-turn behavior tested.
- [x] Suppression, per-recipient scoping, concurrent ticks and action cap tested.
- [x] Production restart and saved-state recovery tested.
- [x] Optional teardown clears application state.
- [x] Official simulator's unchanged warmup method executed through configuration wrapper.
- [x] Full original simulator executed; exits 1 at missing LLM_API_KEY before scoring.
- [x] Adversarial suite executed locally without external disclosure.
- [x] Original challenge materials verified byte-for-byte.
- [x] Windows setup, API examples, deployment guide and changelog included.

## Package verification

See `TEST_REPORT.md` and `reports/clean-verification.txt` for the actual clean-install/build/test/runtime run and `reports/package-verification.json` for the extraction check. The delivered ZIP excludes node_modules, dist, .env, runtime state, Python caches and unrelated files, and extracts into one project directory.

## Still requires your account/action

- [ ] Replace Candidate team identity/contact/submission timestamp with real values in `.env` and hosting environment.
- [ ] Connect Render and authorize repository access, or follow the manual deployment guide.
- [ ] Review and approve the hosting plan/disk charges in your own account.
- [ ] Deploy the actual backend; retrieve its real HTTPS base URL.
- [ ] Run `python scripts/smoke_api.py --url YOUR_REAL_HTTPS_BASE_URL`.
- [ ] Verify restart persistence on the public service and clear smoke data before judge warmup.
- [ ] Confirm the service remains available through the scheduled evaluation.
- [ ] Submit the verified base URL to magicpin.
- [ ] If the portal separately requires a static JSONL, confirm how it treats abstentions. The HTTP contract permits no-action; the old static-file convention does not specify empty-body records.
- [ ] Optionally run actual LLM scoring locally with your own provider credential; no official numeric score is claimed here.
- [ ] After the event, teardown context and remove application data from retained backups per organizer requirements.

No actual public base URL exists from this session. Docker and Windows-native execution were not available for testing. Hidden-judge quality and deployment uptime cannot be inferred from the local test count.
