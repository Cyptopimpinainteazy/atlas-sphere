# Change: Add Neural Terminal + AI Assistant (Explorer)

## Why
The Explorer UI needs a cohesive, signature interaction layer that replaces experimental “demo” content with a curated, brand-forward experience. A small floating Neural Terminal provides fast navigation and an on-site Q&A interface for learning the platform.

## What Changes
- Add a site-wide floating Neural Terminal widget (small, dockable) for command navigation and Q&A.
- Add an internal API endpoint that proxies Q&A requests to OpenRouter using a configured API key.
- Curate the `/quantum` page to keep the strongest elements and remove excessive showcase sections.
- Replace key placeholder visuals with first-party assets from `public/images/branding` and/or `public/media`.

## Impact
- Affected code: `apps/explorer/src/app/layout.tsx`, new components under `apps/explorer/src/components/`, new route under `apps/explorer/src/app/api/`.
- New configuration: `OPENROUTER_API_KEY` (required for Q&A).
- Security considerations: API MUST enforce strict input limits, model allowlist, and no OS-level terminal execution.
