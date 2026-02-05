Setting up a simple n8n webhook route

1) In n8n, add a new Webhook node and set method to POST with a path you control.
2) Configure the webhook URL in this app as N8N_WEBHOOK_URL. The CLI will POST payloads created
   by `N8nPromoter.buildPayload()` to that URL.
3) In n8n continue your flow: parse the incoming JSON, enrich it (add company metadata),
   and connect it to your CRM, Airtable, Slack, or email steps.

Security note: restrict incoming requests to n8n using an API key or network controls.
