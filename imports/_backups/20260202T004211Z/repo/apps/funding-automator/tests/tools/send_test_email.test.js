const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('email send test', ()=>{
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

  test('logs test email when no SMTP configured', async ()=>{
    const log = path.join(process.cwd(),'data','logs','test_emails.log')
    try{ fs.rmSync(log) }catch(e){}
    const resp = await axios.post('http://localhost:3000/email/send-test', { to: 'me@example.com', subject: 't', body: 'b' })
    expect(resp.data.ok).toBe(true)
    // test_emails.log should exist and contain an entry
    const content = fs.readFileSync(log,'utf8')
    expect(content).toContain('me@example.com')
  })
})
