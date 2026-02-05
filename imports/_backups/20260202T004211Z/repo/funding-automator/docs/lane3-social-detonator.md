# Lane 3 — Social Detonator

Import path: use `n8n/lane3-social-detonator.json` in n8n (Import Workflow).

What it does:
- Polls a local video queue at `http://localhost:3000/queue/videos/pending` for new assets.\
- Splits items into single-video batches and picks target platforms (default: YouTube, X, TikTok).\
- Applies a Delay node to throttle activity.\
- Posts to platform endpoints (placeholders) and logs each upload to `/data/logs/uploads.log`.\
- Marks video items as done in the queue via `POST /queue/videos/mark-done`.

Notes and setup:
- This workflow uses placeholder endpoints on localhost so you can test without live API keys. Replace the platform URLs with real API calls (YouTube multipart upload, TikTok/IG partner APIs, X API).\
- You should create a small queue-service (or use Airtable/Google Sheets) at `localhost:3000` that exposes the following endpoints for testing: `/queue/videos/pending` (GET), `/queue/videos` (POST), `/queue/videos/mark-done` (POST), and platform endpoints under `/platforms/*`.
- Throttle settings: `Delay` node is set to 10s per item by default — increase to 30–300s for real platform limits. Keep platform-friendly rates: YouTube 1–3 uploads/day, TikTok rotate accounts/10 uploads/day, X ~3–5 posts/day.

Testing locally:

1. Start a simple queue stub server (example: small express app) to accept queue posts and return pending items.
2. Add a metadata JSON into `/data/staging/videos/` for `id`, `path`, and `thumb` (files created by Lane 2).\
3. Trigger the workflow manually in n8n and observe upload placeholder calls hitting your local server.
