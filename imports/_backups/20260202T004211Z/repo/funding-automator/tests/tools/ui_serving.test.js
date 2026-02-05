<<<<<<< REPO
const axios = require('axios')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('approval UI serving (skipped - express not installed)', () => {})
} else {
  describe('approval UI serving', ()=>{
  let proc
  beforeAll(async ()=>{
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait a little
    const start = Date.now(); let ok=false
    while (Date.now()-start < 8000){ try{ await axios.get('http://localhost:3000/ui'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('ui not available')
  }, 15000)
  afterAll(()=>{ if (proc && !proc.killed) proc.kill() })

  test('serves index.html at /ui', async ()=>{
    const res = await axios.get('http://localhost:3000/ui')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.data).toContain('NovaFlux — Approval Dashboard')
  })
  })
}

=======
const axios = require('axios')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('approval UI serving (skipped - express not installed)', () => {})
} else {
  describe('approval UI serving', ()=>{
  let proc
  beforeAll(async ()=>{
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait a little
    const start = Date.now(); let ok=false
    while (Date.now()-start < 8000){ try{ await axios.get('http://localhost:3000/ui'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('ui not available')
  }, 15000)
  afterAll(()=>{ if (proc && !proc.killed) proc.kill() })

  test('serves index.html at /ui', async ()=>{
    const res = await axios.get('http://localhost:3000/ui')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.data).toContain('NovaFlux — Approval Dashboard')
  })
  })
}

>>>>>>> IMPORT (TEXT)
