<<<<<<< REPO
<<<<<<< REPO
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('bounce tracking', ()=>{
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

  test('POST /email/bounce stores bounces and /email/bounces returns them', async ()=>{
    const base = 'http://localhost:3000'
    const recipient = 'bounce_test@example.com'
    const messageId = 'fake-msgid-123'
    await axios.post(`${base}/email/bounce`, { messageId, recipient, reason: 'hard bounce' })
    const b = await axios.get(`${base}/email/bounces`)
    expect(b.data[recipient]).toBeTruthy()
    expect(b.data[recipient].messageId).toBe(messageId)
  })
})

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('bounce tracking', ()=>{
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

  test('POST /email/bounce stores bounces and /email/bounces returns them', async ()=>{
    const base = 'http://localhost:3000'
    const recipient = 'bounce_test@example.com'
    const messageId = 'fake-msgid-123'
    await axios.post(`${base}/email/bounce`, { messageId, recipient, reason: 'hard bounce' })
    const b = await axios.get(`${base}/email/bounces`)
    expect(b.data[recipient]).toBeTruthy()
    expect(b.data[recipient].messageId).toBe(messageId)
  })
})

>>>>>>> IMPORT (TEXT)

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

describe('bounce tracking', ()=>{
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

  test('POST /email/bounce stores bounces and /email/bounces returns them', async ()=>{
    const base = 'http://localhost:3000'
    const recipient = 'bounce_test@example.com'
    const messageId = 'fake-msgid-123'
    await axios.post(`${base}/email/bounce`, { messageId, recipient, reason: 'hard bounce' })
    const b = await axios.get(`${base}/email/bounces`)
    expect(b.data[recipient]).toBeTruthy()
    expect(b.data[recipient].messageId).toBe(messageId)
  })
})

>>>>>>> IMPORT (TEXT)
