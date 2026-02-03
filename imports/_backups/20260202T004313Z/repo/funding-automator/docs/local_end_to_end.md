# Local end-to-end testing

Quick helpers to test the pipeline locally.

1) Start the queue stub (provides queue endpoints + platform placeholders):

```bash
pnpm install # or npm install
npm run start:queue
```

2) Populate staging files from the provided CSV:

```bash
npm run csv:to-staging
# To also enqueue created items into the queue stub:
node tools/csv_to_staging.js --enqueue
```

3) In n8n, import `n8n/lane2-video-auto-forge.json` and `n8n/lane3-social-detonator.json`.
   - Lane 2 reads `/data/staging/text.json` or multiple files under `/data/staging/texts/` depending on your setup.
   - Lane 3 polls `http://localhost:3000/queue/videos/pending` (the queue stub).

4) Use the `tools/ffmpeg_pipeline.sh` helper to locally generate demo videos from scripts for quick tests.

Notes: adjust paths and TTS commands to match your environment. The queue stub endpoints are dummy placeholders useful during local development and replaceable with production API calls later.
