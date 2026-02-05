# Funding Automator

Small prototype CLI to find prospects, generate personalized outreach, and deliver via transports like SMTP or n8n webhooks.

Key features in this scaffold:
- n8n promoter module returning webhook payloads
- SMTP transport (nodemailer) example
- An `X` transport stub for social outreach API integration
- A small Google-search helper to generate dork queries (stubbed for safe use)

Setup

1. Install deps:

```bash
cd funding-automator
npm install
```

2. Run tests:

```bash
npm test
```

Usage (dev):

```bash
npm start -- --help
```

Ethics & Safety

This tool is a prototype and contains network stubs. When integrating automated outreach flows, ensure you follow platform terms of service, anti-spam laws, and privacy regulations.
