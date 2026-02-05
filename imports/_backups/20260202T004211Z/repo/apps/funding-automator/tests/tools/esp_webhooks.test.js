const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')
const crypto = require('crypto')

describe('ESP webhooks (SendGrid + Postmark)', ()=>{
  let proc
  beforeAll(async ()=>{
    // start server fresh if not running
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'], env: Object.assign({}, process.env) })
    const start = Date.now(); let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)
  afterAll(()=>{ if (proc && !proc.killed) proc.kill() })

  test('SendGrid event signature verification and bounce mapping', async ()=>{
    // create a public/private keypair, set public key in env by restarting server
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' })
    const privPem = privateKey.export({ type: 'pkcs1', format:'pem' })

    // restart server with SENDGRID_PUBLIC_KEY set
    if (proc && !proc.killed) proc.kill()
    proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'], env: Object.assign({}, process.env, { SENDGRID_PUBLIC_KEY: pubPem }) })
    const start = Date.now(); let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    expect(ok).toBe(true)

    const body = JSON.stringify([{ event:'bounce', email: 'bounce1@example.com', sg_message_id: 'msg-9' }])
    const ts = Math.floor(Date.now()/1000).toString()
    const payload = ts + body
    const signer = crypto.createSign('RSA-SHA256'); signer.update(payload); signer.end()
    const signature = signer.sign(privPem, 'base64')

    // verify locally first
    const verifyLocal = crypto.createVerify('RSA-SHA256'); verifyLocal.update(ts + body); verifyLocal.end();
    expect(verifyLocal.verify(pubPem, signature, 'base64')).toBe(true);

    const res = await axios.post('http://localhost:3000/webhook/sendgrid/events', body, { headers: { 'Content-Type':'application/json', 'X-Twilio-Email-Event-Webhook-Signature': signature, 'X-Twilio-Email-Event-Webhook-Timestamp': ts } })
    expect(res.data.ok).toBe(true)
    const bounces = JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','bounces.json'),'utf8'))
    expect(bounces['bounce1@example.com']).toBeTruthy()

    const suppressed = JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','suppressed.json'),'utf8'))
    expect(suppressed['bounce1@example.com']).toBeTruthy()

    // check audit log via endpoint
    const auditRes = await axios.get('http://localhost:3000/suppressions/audit?page=1&pageSize=50');
    expect(auditRes.data).toHaveProperty('entries')
    const found = auditRes.data.entries.find(e => e.recipient === 'bounce1@example.com' && e.source === 'sendgrid' && e.action === 'add')
    expect(found).toBeTruthy()

    // Create a staging lead that points to the suppressed address and verify send is skipped
    const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-supp-1'
    const meta = { id, org:'SuppTest', contact: 'bounce1@example.com', notes:'suppressed test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const sendResp = await axios.post('http://localhost:3000/email/send', { id, variantIndex: 0 })
    expect(sendResp.data.ok).toBe(true)
    expect(sendResp.data.skipped).toBe(true)
  })

  test('Postmark webhook verification and bounce mapping', async ()=>{
    // restart server with POSTMARK_WEBHOOK_TOKEN env
    if (proc && !proc.killed) proc.kill()
    proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'], env: Object.assign({}, process.env, { POSTMARK_WEBHOOK_TOKEN: 'tok-123' }) })
    const start = Date.now(); let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    expect(ok).toBe(true)

    const payload = { RecordType: 'Bounce', EmailAddress: 'postmark-bounce@example.com', MessageID: 'pm-1', BounceDescription: 'Test bounce' }
    const res = await axios.post('http://localhost:3000/webhook/postmark/events', payload, { headers: { 'Content-Type':'application/json', 'X-Postmark-Signature': 'tok-123' } })
    expect(res.data.ok).toBe(true)
    const bounces = JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','bounces.json'),'utf8'))
    expect(bounces['postmark-bounce@example.com']).toBeTruthy()
    const suppressedPm = JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','suppressed.json'),'utf8'))
    expect(suppressedPm['postmark-bounce@example.com']).toBeTruthy()
    const audit2 = await axios.get('http://localhost:3000/suppressions/audit?page=1&pageSize=50');
    const foundPm = audit2.data.entries.find(e => e.recipient === 'postmark-bounce@example.com' && e.source === 'postmark' && e.action === 'add')
    expect(foundPm).toBeTruthy()
  })
})
