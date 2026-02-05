<<<<<<< REPO
import { N8nPromoter } from './promoters/n8nPromoter'
import { sendWebhook } from './transports/webhook'
import { sendSmtp } from './transports/smtpTransport'
import { renderTemplate } from './templates/template'

async function main () {
  const mode = process.argv[2] || 'demo'

  if (mode === 'demo') {
    const promoter = new N8nPromoter({ project: 'Dual-blockchain SVM/EVM' })
    const payload = promoter.buildPayload({
      name: 'Angel Fund',
      description: 'Interest in next-gen EVM/SVM interoperability.'
    })

    console.log('n8n payload (preview):', JSON.stringify(payload, null, 2))

    // send to n8n webhook if N8N_WEBHOOK_URL is set
    if (process.env.N8N_WEBHOOK_URL) {
      await sendWebhook(process.env.N8N_WEBHOOK_URL, payload)
      console.log('Sent webhook to n8n')
    }

    // demo SMTP: prepare message
    const message = renderTemplate('intro', { project: 'Dual-blockchain SVM/EVM' })
    if (process.env.SMTP_TO) {
      await sendSmtp({
        to: process.env.SMTP_TO,
        subject: 'Funding inquiry — ' + 'Dual-blockchain SVM/EVM',
        text: message
      })
      console.log('Sent SMTP (demo)')
    }

    console.log('Demo complete — set env vars to actually send (N8N_WEBHOOK_URL, SMTP_TO).')
  } else {
    console.log('Usage: node index.js [demo]')
  }
}

main().catch((err) => {
  // keep CLI failure output short for now
  console.error('Fatal:', err?.message ?? err)
  process.exit(1)
})

=======
import { N8nPromoter } from './promoters/n8nPromoter'
import { sendWebhook } from './transports/webhook'
import { sendSmtp } from './transports/smtpTransport'
import { renderTemplate } from './templates/template'

async function main () {
  const mode = process.argv[2] || 'demo'

  if (mode === 'demo') {
    const promoter = new N8nPromoter({ project: 'Dual-blockchain SVM/EVM' })
    const payload = promoter.buildPayload({
      name: 'Angel Fund',
      description: 'Interest in next-gen EVM/SVM interoperability.'
    })

    console.log('n8n payload (preview):', JSON.stringify(payload, null, 2))

    // send to n8n webhook if N8N_WEBHOOK_URL is set
    if (process.env.N8N_WEBHOOK_URL) {
      await sendWebhook(process.env.N8N_WEBHOOK_URL, payload)
      console.log('Sent webhook to n8n')
    }

    // demo SMTP: prepare message
    const message = renderTemplate('intro', { project: 'Dual-blockchain SVM/EVM' })
    if (process.env.SMTP_TO) {
      await sendSmtp({
        to: process.env.SMTP_TO,
        subject: 'Funding inquiry — ' + 'Dual-blockchain SVM/EVM',
        text: message
      })
      console.log('Sent SMTP (demo)')
    }

    console.log('Demo complete — set env vars to actually send (N8N_WEBHOOK_URL, SMTP_TO).')
  } else {
    console.log('Usage: node index.js [demo]')
  }
}

main().catch((err) => {
  // keep CLI failure output short for now
  console.error('Fatal:', err?.message ?? err)
  process.exit(1)
})

>>>>>>> IMPORT (TEXT)
