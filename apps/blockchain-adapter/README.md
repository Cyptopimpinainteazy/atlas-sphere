Blockchain Adapter

Purpose: Adapter service to ingest business events (ERP, inventory), transform them into canonical messages, and submit relevant transactions to EVM/X3VM/SVM via RPC or through the relayer.

Run (dev):
- Copy `src/config.example.json` -> `src/config.json` and set endpoints
- npm install
- npm run start

PoC responsibilities:
- Accept REST events for "create-part" and "confirm-delivery"
- Submit provenance anchor to EVM and settlement trigger to X3VM
- Provide idempotent receipts for events

See `src` for implementation skeleton.