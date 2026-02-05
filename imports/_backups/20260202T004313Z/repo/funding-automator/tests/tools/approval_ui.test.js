<<<<<<< REPO
<<<<<<< REPO
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const axios = require('axios')

const QUEUE_DIR = path.join(process.cwd(),'data','staging','funding_queue')

const hasExpress = (() => { try { require.resolve('express'); return true } catch(e){ return false } })();

if (!hasExpress){
  test.skip('approval UI flow (skipped - express not installed)', () => {})
} else {
  describe('approval UI flow', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // if a stub is already running, reuse it; otherwise spawn
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for http server to respond
    const base = 'http://localhost:3000'
    const start = Date.now()
    let ok = false
    while (Date.now() - start < 15000){
      try{ await axios.get(base + '/queue/videos/pending'); ok = true; break }catch(e){ await new Promise(r=>setTimeout(r,200)); }
    }
    if (!ok) throw new Error('queue_stub did not start in time')
  }, 20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify creates queue and approval UI shows the pitch variants and approving writes log', async ()=>{
    // prepare funding queue and pitch
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-ui-1'
    const meta = { id, org: 'UIFund', contact: 'ui@example.com', notes: 'ui test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' }, { subject:'s2', body:'b2' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    // check approvals listing
    const list = (await axios.get(`${base}/approvals`)).data
    expect(Array.isArray(list)).toBe(true)

    // create a suppressed entry for this lead's contact and verify UI shows suppressed marker
    await axios.post(`${base}/suppressions`, { recipient: 'ui@example.com', reason: 'test bounce' })
    // audit should include this add
    const audit1 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(Array.isArray(audit1.entries)).toBe(true)
    expect(audit1.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'add' && e.source === 'manual')).toBeTruthy()
    // fetch UI page
    const page = await axios.get(`${base}/approvals/${id}`)
    expect(page.status).toBe(200)
    expect(page.data).toContain('Variant 1')
    expect(page.data).toContain('Suppressed:')

    // approve variant 1
    const resp = await axios.post(`${base}/approvals/approve`, `id=${id}&variantIndex=1`, { headers: {'Content-Type':'application/x-www-form-urlencoded'} })
    expect(resp.data.ok).toBe(true)

    // check that pitch file has sentVariant write
    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(1)

    // check log line
    const log = fs.readFileSync(path.join(process.cwd(),'data','logs','funding_sent.log'),'utf8')
    expect(log).toContain(id)

    // remove suppression and verify page no longer says suppressed
    await axios.delete(`${base}/suppressions/ui@example.com`)
    // audit should include remove
    const audit2 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(audit2.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'remove')).toBeTruthy()
    const page2 = await axios.get(`${base}/approvals/${id}`)
    expect(page2.data).not.toContain('Suppressed:')
  },20000)
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
  test.skip('approval UI flow (skipped - express not installed)', () => {})
} else {
  describe('approval UI flow', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // if a stub is already running, reuse it; otherwise spawn
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for http server to respond
    const base = 'http://localhost:3000'
    const start = Date.now()
    let ok = false
    while (Date.now() - start < 15000){
      try{ await axios.get(base + '/queue/videos/pending'); ok = true; break }catch(e){ await new Promise(r=>setTimeout(r,200)); }
    }
    if (!ok) throw new Error('queue_stub did not start in time')
  }, 20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify creates queue and approval UI shows the pitch variants and approving writes log', async ()=>{
    // prepare funding queue and pitch
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-ui-1'
    const meta = { id, org: 'UIFund', contact: 'ui@example.com', notes: 'ui test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' }, { subject:'s2', body:'b2' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    // check approvals listing
    const list = (await axios.get(`${base}/approvals`)).data
    expect(Array.isArray(list)).toBe(true)

    // create a suppressed entry for this lead's contact and verify UI shows suppressed marker
    await axios.post(`${base}/suppressions`, { recipient: 'ui@example.com', reason: 'test bounce' })
    // audit should include this add
    const audit1 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(Array.isArray(audit1.entries)).toBe(true)
    expect(audit1.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'add' && e.source === 'manual')).toBeTruthy()
    // fetch UI page
    const page = await axios.get(`${base}/approvals/${id}`)
    expect(page.status).toBe(200)
    expect(page.data).toContain('Variant 1')
    expect(page.data).toContain('Suppressed:')

    // approve variant 1
    const resp = await axios.post(`${base}/approvals/approve`, `id=${id}&variantIndex=1`, { headers: {'Content-Type':'application/x-www-form-urlencoded'} })
    expect(resp.data.ok).toBe(true)

    // check that pitch file has sentVariant write
    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(1)

    // check log line
    const log = fs.readFileSync(path.join(process.cwd(),'data','logs','funding_sent.log'),'utf8')
    expect(log).toContain(id)

    // remove suppression and verify page no longer says suppressed
    await axios.delete(`${base}/suppressions/ui@example.com`)
    // audit should include remove
    const audit2 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(audit2.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'remove')).toBeTruthy()
    const page2 = await axios.get(`${base}/approvals/${id}`)
    expect(page2.data).not.toContain('Suppressed:')
  },20000)
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
  test.skip('approval UI flow (skipped - express not installed)', () => {})
} else {
  describe('approval UI flow', () => {
  let proc
  beforeAll(async ()=>{
    try{ fs.rmSync(path.dirname(path.join(process.cwd(),'data','queue_db','videos.json')), {recursive:true}) }catch(e){}
    // if a stub is already running, reuse it; otherwise spawn
    let running = false
    try{ await axios.get('http://localhost:3000/queue/videos/pending'); running = true }catch(e){ running = false }
    if (!running) proc = spawn('node', ['tools/queue_stub.js'], { stdio: ['ignore','pipe','pipe'] })
    // wait for http server to respond
    const base = 'http://localhost:3000'
    const start = Date.now()
    let ok = false
    while (Date.now() - start < 15000){
      try{ await axios.get(base + '/queue/videos/pending'); ok = true; break }catch(e){ await new Promise(r=>setTimeout(r,200)); }
    }
    if (!ok) throw new Error('queue_stub did not start in time')
  }, 20000)

  afterAll(()=>{ if (proc && !proc.killed) proc.kill(); try{ fs.rmSync(QUEUE_DIR,{recursive:true,force:true}) }catch(e){} })

  test('notify creates queue and approval UI shows the pitch variants and approving writes log', async ()=>{
    // prepare funding queue and pitch
    if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true })
    const id = 'lead-ui-1'
    const meta = { id, org: 'UIFund', contact: 'ui@example.com', notes: 'ui test' }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(meta,null,2))
    const pitch = { id, variants: [ { subject: 's1', body: 'b1' }, { subject:'s2', body:'b2' } ] }
    fs.writeFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), JSON.stringify(pitch,null,2))

    const base = 'http://localhost:3000'
    // check approvals listing
    const list = (await axios.get(`${base}/approvals`)).data
    expect(Array.isArray(list)).toBe(true)

    // create a suppressed entry for this lead's contact and verify UI shows suppressed marker
    await axios.post(`${base}/suppressions`, { recipient: 'ui@example.com', reason: 'test bounce' })
    // audit should include this add
    const audit1 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(Array.isArray(audit1.entries)).toBe(true)
    expect(audit1.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'add' && e.source === 'manual')).toBeTruthy()
    // fetch UI page
    const page = await axios.get(`${base}/approvals/${id}`)
    expect(page.status).toBe(200)
    expect(page.data).toContain('Variant 1')
    expect(page.data).toContain('Suppressed:')

    // approve variant 1
    const resp = await axios.post(`${base}/approvals/approve`, `id=${id}&variantIndex=1`, { headers: {'Content-Type':'application/x-www-form-urlencoded'} })
    expect(resp.data.ok).toBe(true)

    // check that pitch file has sentVariant write
    const updated = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${id}.pitch.json`), 'utf8'))
    expect(updated.sentVariant).toBe(1)

    // check log line
    const log = fs.readFileSync(path.join(process.cwd(),'data','logs','funding_sent.log'),'utf8')
    expect(log).toContain(id)

    // remove suppression and verify page no longer says suppressed
    await axios.delete(`${base}/suppressions/ui@example.com`)
    // audit should include remove
    const audit2 = (await axios.get(`${base}/suppressions/audit?page=1&pageSize=50`)).data
    expect(audit2.entries.find(e => e.recipient === 'ui@example.com' && e.action === 'remove')).toBeTruthy()
    const page2 = await axios.get(`${base}/approvals/${id}`)
    expect(page2.data).not.toContain('Suppressed:')
  },20000)
  })
}

>>>>>>> IMPORT (TEXT)
