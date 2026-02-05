<<<<<<< REPO
<<<<<<< REPO
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('slack integration simulation (skipped - express not installed)', () => {})
} else {
  describe('slack integration simulation', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // spawn queue stub if not already running
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for server
    const start = Date.now();
    let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify/slack returns messageUrl and /slack/action approves', async ()=>{
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-slack-1'
    const meta = { id, org: 'SlackFund', contact: 'slack@example.com', notes: 'slack test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    const notify = await axios.post(`${base}/notify/slack`, { id })
    expect(notify.data.ok).toBe(true)
    expect(notify.data.messageUrl).toBe(`/approvals/${id}`)

    const action = await axios.post(`${base}/slack/action`, { id, action: 'approve', variantIndex: 0 })
    expect(action.data.ok).toBe(true)

    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(0)
  }, 15000)
  })
}

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('slack integration simulation (skipped - express not installed)', () => {})
} else {
  describe('slack integration simulation', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // spawn queue stub if not already running
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for server
    const start = Date.now();
    let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify/slack returns messageUrl and /slack/action approves', async ()=>{
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-slack-1'
    const meta = { id, org: 'SlackFund', contact: 'slack@example.com', notes: 'slack test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    const notify = await axios.post(`${base}/notify/slack`, { id })
    expect(notify.data.ok).toBe(true)
    expect(notify.data.messageUrl).toBe(`/approvals/${id}`)

    const action = await axios.post(`${base}/slack/action`, { id, action: 'approve', variantIndex: 0 })
    expect(action.data.ok).toBe(true)

    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(0)
  }, 15000)
  })
}

>>>>>>> IMPORT (TEXT)

=======
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('slack integration simulation (skipped - express not installed)', () => {})
} else {
  describe('slack integration simulation', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // spawn queue stub if not already running
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for server
    const start = Date.now();
    let ok=false
    while (Date.now()-start < 10000){ try{ await axios.get('http://localhost:3000/queue/videos/pending'); ok=true; break }catch(e){ await new Promise(r=>setTimeout(r,200)) } }
    if (!ok) throw new Error('queue_stub not running')
  },20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify/slack returns messageUrl and /slack/action approves', async ()=>{
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-slack-1'
    const meta = { id, org: 'SlackFund', contact: 'slack@example.com', notes: 'slack test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    const notify = await axios.post(`${base}/notify/slack`, { id })
    expect(notify.data.ok).toBe(true)
    expect(notify.data.messageUrl).toBe(`/approvals/${id}`)

    const action = await axios.post(`${base}/slack/action`, { id, action: 'approve', variantIndex: 0 })
    expect(action.data.ok).toBe(true)

    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(0)
  }, 15000)
  })
}

>>>>>>> IMPORT (TEXT)
