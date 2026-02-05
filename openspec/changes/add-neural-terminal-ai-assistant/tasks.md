## 1. Neural Terminal UI
- [ ] 1.1 Add a floating terminal widget mounted from the root layout.
- [ ] 1.2 Implement command routing: `help`, `clear`, `go <path>`, `open <path>`.
- [ ] 1.3 Implement Q&A command: `ask <question>` and UI send button.
- [ ] 1.4 Persist minimal UI state (open/closed + last position) in `localStorage`.

## 2. AI Q&A API
- [ ] 2.1 Add `POST /api/ai/ask` route handler.
- [ ] 2.2 Validate inputs (length, content-type) and enforce rate/size limits.
- [ ] 2.3 Call OpenRouter with a free/default model and return JSON response.
- [ ] 2.4 Add clear error handling for missing `OPENROUTER_API_KEY`.

## 3. Quantum Curation + Assets
- [ ] 3.1 Remove or hide the large experimental showcase blocks on `/quantum`.
- [ ] 3.2 Keep Neural Validator globe and 1–2 top-tier effects only.
- [ ] 3.3 Replace placeholder images with assets from `public/images/branding`.
- [ ] 3.4 Add hyperlinks to slider/gallery items where applicable.

## 4. Verification
- [ ] 4.1 Run Explorer typecheck/build and confirm `/quantum` loads without Next cache errors.
- [ ] 4.2 Confirm terminal navigation works across multiple routes.
- [ ] 4.3 Confirm Q&A returns responses using OpenRouter.
