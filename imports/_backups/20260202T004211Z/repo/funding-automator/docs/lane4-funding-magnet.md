# Lane 4 — Funding Magnet

Import path: `n8n/lane4-funding-magnet.json` (import into n8n).

Overview:
- Cron-driven scrapers gather grant/VC listings and normalize them into candidate opportunities.\
- For each candidate the workflow calls a local LLM endpoint to draft a micro-pitch tailored to the organization.\
- An email verification check (placeholder) is performed. Valid leads are written to `/data/staging/funding_queue/` and a Slack/approval notification is issued.\
- Human approval happens via an n8n webhook (`/webhook/funding/approve`) which triggers the final send.

Notes:
- This workflow uses placeholder endpoints and local LLM server URLs — replace them with your real scrapers, verification services, and LLM endpoint.\
- Use burner sending domains and rotate them per campaign to protect main deliverability; configure proper SPF/DKIM/DMARC for each sender domain before production sending.\
- Keep send volumes modest per domain (20–50/day) and implement bounce handling + backoff.\

Quick local test example (no external provider required):

1. Start a small stub server on `localhost:3000` with endpoints:
   - `POST /grants/check` — returns { handled: false } for new IDs
   - `POST /verifier/verify` — returns { deliverable: true }
   - `POST /notify/approval` — accepts and logs notifications

2. Start a local LLM server compatible with the workflow's URL (e.g., Ollama or llama.cpp REST wrapper) at `http://localhost:11434/api/generate`.

3. Manually trigger the Cron or call the webhook to run the pipeline and write queue items into `/data/staging/funding_queue/`.

Pitch generation & approval flow:

- After new queue items are written to `/data/staging/funding_queue/<id>.json`, run the pitch generator to create 3 pitch variants per lead:

```bash
npm run generate:pitches
```

- This creates `/data/staging/funding_queue/<id>.pitch.json` with the variants for review.
- The workflow notifies your approval channel (placeholder `POST /notify/approval`) — when approved, call the webhook `/webhook/funding/approve` with `{ id: '<id>' }` which triggers sending a selected pitch variant via the SMTP node.

Approvals UI (local testing):

- The local queue stub provides a tiny approvals interface at `GET /approvals` (lists pending funding leads) and `GET /approvals/<id>` which renders a minimal HTML page with the generated variants and Approve buttons.
- Approve buttons POST to `/approvals/approve` which forwards the selection to the webhook endpoint (`/webhook/funding/approve`). The stub implements `/webhook/funding/approve` and writes the sent variant to `/data/staging/funding_queue/<id>.pitch.json` plus a log at `/data/logs/funding_sent.log` — this simulates the n8n approval → send flow locally.

Example: Open the approver for a candidate named `lead123`:

```
http://localhost:3000/approvals/lead123
```

When you press Approve the stub forwards to the webhook and marks the chosen variant as sent.

Approval Dashboard UI:

- For a richer experience, visit http://localhost:3000/ui (served by the local queue stub). The dashboard lists pending leads, shows metadata, previews generated pitch variants, and allows selecting a variant and approving it. The UI submits approvals to /approvals/approve and shows success/failure results.

Slack integration (local simulation):

- Use the stub's `POST /notify/slack` with JSON `{ id: '<lead-id>' }` to simulate sending a Slack interactive message. The response includes `messageUrl` pointing to the approval page (e.g. `/approvals/<id>`).
- To simulate a Slack button click, `POST /slack/action` with `{ id: '<lead-id>', action: 'approve', variantIndex: 0 }`. The stub will forward this to the approval webhook and mark the selected variant as sent (writing `/data/staging/funding_queue/<id>.pitch.json` and appending to `/data/logs/funding_sent.log`).

Email templates & pitch variants:

Find starter templates in `persona/pitch_templates.md` — they work well as prompt bases or direct copy for outreach messages. The generator will call a local LLM (or fallback) to create tailored variants.
