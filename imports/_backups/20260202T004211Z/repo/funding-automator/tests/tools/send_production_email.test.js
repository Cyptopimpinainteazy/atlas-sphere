<<<<<<< REPO
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

describe('production email send', ()=>{
  let proc
  beforeAll(async ()=>{
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    const start = Date.now(); let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill() })

  test('POST /email/send logs when SMTP not configured', async ()=>{
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-prod-1'
    const meta = { id, org:'ProdFund', contact: 'prod@example.com', notes:'prod test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    const resp = await axios.post(`${base}/email/send`, { id, variantIndex: 0 })
    expect(resp.data.ok).toBe(true)
    // since SMTP not configured in CI, entry should be logged in funding_sent.log or test_emails.log
    const log1 = path.join(process.cwd(),'data','logs','funding_sent.log')
    const log2 = path.join(process.cwd(),'data','logs','test_emails.log')
    const content = (fs.existsSync(log1)? fs.readFileSync(log1,'utf8') : '') + (fs.existsSync(log2)? fs.readFileSync(log2,'utf8') : '')
    expect(content).toContain(id)
  })
})

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

describe('production email send', ()=>{
  let proc
  beforeAll(async ()=>{
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    const start = Date.now(); let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill() })

  test('POST /email/send logs when SMTP not configured', async ()=>{
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-prod-1'
    const meta = { id, org:'ProdFund', contact: 'prod@example.com', notes:'prod test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    const resp = await axios.post(`${base}/email/send`, { id, variantIndex: 0 })
    expect(resp.data.ok).toBe(true)
    // since SMTP not configured in CI, entry should be logged in funding_sent.log or test_emails.log
    const log1 = path.join(process.cwd(),'data','logs','funding_sent.log')
    const log2 = path.join(process.cwd(),'data','logs','test_emails.log')
    const content = (fs.existsSync(log1)? fs.readFileSync(log1,'utf8') : '') + (fs.existsSync(log2)? fs.readFileSync(log2,'utf8') : '')
    expect(content).toContain(id)
  })
})

>>>>>>> IMPORT (TEXT)
